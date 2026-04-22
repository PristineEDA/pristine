import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const compareScriptPath = path.join(repoRoot, 'compare-perf-taskmgr.ps1')
const systemPowerShellPath = path.join(
  process.env['SystemRoot'] ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
)

function createSummary(overrides = {}) {
  return {
    processName: 'default',
    durationSeconds: 1,
    sampleIntervalSeconds: 1,
    sampleCount: 1,
    observedIntervalSeconds: 1,
    cpu: {
      systemUtilityAveragePercent: 4.2,
      processUtilityAveragePercent: 0.4,
    },
    memory: {
      totalPhysicalBytes: 32 * 1024 * 1024 * 1024,
      workingSetAverageBytes: 420 * 1024 * 1024,
      workingSetPeakBytes: 460 * 1024 * 1024,
      workingSetAveragePercentOfSystemMemory: 1.28,
      workingSetPeakPercentOfSystemMemory: 1.4,
      privateBytesAverageBytes: 300 * 1024 * 1024,
      privateBytesPeakBytes: 330 * 1024 * 1024,
    },
    disk: {
      readAverageBytesPerSecond: 0,
      readTotalBytes: 0,
      writeAverageBytesPerSecond: 0,
      writeTotalBytes: 0,
    },
    network: {
      systemReceiveAverageBytesPerSecond: 0,
      systemReceiveTotalBytes: 0,
      systemSendAverageBytesPerSecond: 0,
      systemSendTotalBytes: 0,
      maxTcpConnectionCount: 0,
      maxEstablishedTcpConnectionCount: 0,
      uniqueRemoteAddressCount: 0,
      remoteAddresses: [],
    },
    ...overrides,
  }
}

function createSequentialSummaries(scenario) {
  if (scenario === 'memory-fail') {
    return [
      createSummary({
        processName: 'dev-powershell',
      }),
      createSummary({
        processName: 'packaged-powershell',
        cpu: {
          systemUtilityAveragePercent: 4.0,
          processUtilityAveragePercent: 0.55,
        },
        memory: {
          totalPhysicalBytes: 32 * 1024 * 1024 * 1024,
          workingSetAverageBytes: 900 * 1024 * 1024,
          workingSetPeakBytes: 980 * 1024 * 1024,
          workingSetAveragePercentOfSystemMemory: 2.75,
          workingSetPeakPercentOfSystemMemory: 2.99,
          privateBytesAverageBytes: 620 * 1024 * 1024,
          privateBytesPeakBytes: 700 * 1024 * 1024,
        },
      }),
    ]
  }

  return [
    createSummary({
      processName: 'dev-powershell',
      cpu: {
        systemUtilityAveragePercent: 4.2,
        processUtilityAveragePercent: 0.4,
      },
      network: {
        systemReceiveAverageBytesPerSecond: 512,
        systemReceiveTotalBytes: 512,
        systemSendAverageBytesPerSecond: 256,
        systemSendTotalBytes: 256,
        maxTcpConnectionCount: 1,
        maxEstablishedTcpConnectionCount: 1,
        uniqueRemoteAddressCount: 1,
        remoteAddresses: ['127.0.0.1'],
      },
    }),
    createSummary({
      processName: 'packaged-powershell',
      cpu: {
        systemUtilityAveragePercent: 4.0,
        processUtilityAveragePercent: 0.6,
      },
      memory: {
        totalPhysicalBytes: 32 * 1024 * 1024 * 1024,
        workingSetAverageBytes: 510 * 1024 * 1024,
        workingSetPeakBytes: 540 * 1024 * 1024,
        workingSetAveragePercentOfSystemMemory: 1.56,
        workingSetPeakPercentOfSystemMemory: 1.65,
        privateBytesAverageBytes: 360 * 1024 * 1024,
        privateBytesPeakBytes: 380 * 1024 * 1024,
      },
    }),
  ]
}

function createTempPerfHarness(sequentialSummaries) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'pristine-compare-perf-'))
  const fakeSamplerPath = path.join(tempDir, 'fake-perf-sampler.ps1')
  const callCountPath = path.join(tempDir, 'perf-call-count.txt')

  writeFileSync(fakeSamplerPath, [
    '[CmdletBinding()]',
    'param(',
    '    [string]$ProcessName,',
    '    [int]$DurationSeconds,',
    "    [string]$OutputFormat = 'Json'",
    ')',
    `$callCountPath = '${callCountPath.replace(/'/g, "''")}'`,
    '$summaries = @(',
    ...sequentialSummaries.map((summary) => {
      const encodedSummary = Buffer.from(JSON.stringify(summary), 'utf8').toString('base64')
      return "    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('" + encodedSummary + "'))"
    }),
    ')',
    '$invocationIndex = 0',
    'if (Test-Path -LiteralPath $callCountPath) {',
    '    $invocationIndex = [int](Get-Content -LiteralPath $callCountPath -Raw)',
    '}',
    'if ($invocationIndex -ge $summaries.Count) {',
    '    throw "Unexpected sampler invocation index: $invocationIndex for process $ProcessName"',
    '}',
    'if ($OutputFormat -ne "Json") {',
    '    throw "Fake sampler only supports Json output mode."',
    '}',
    'Set-Content -LiteralPath $callCountPath -Value ($invocationIndex + 1)',
    '$summaries[$invocationIndex]',
    '',
  ].join('\r\n'), 'utf8')

  return {
    tempDir,
    fakeSamplerPath,
  }
}

function runCompareScript(args) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-File', compareScriptPath, ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    },
  )

  if (result.error) {
    const message = result.error.stack ?? `${result.error.name}: ${result.error.message}`
    throw new Error(message)
  }

  if (result.signal) {
    throw new Error(`Compare script terminated by signal ${result.signal}`)
  }

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const scenario = process.argv[2]

if (scenario !== 'pass' && scenario !== 'memory-fail') {
  console.error(`Unsupported scenario: ${scenario ?? '<missing>'}`)
  process.exit(2)
}

const harness = createTempPerfHarness(createSequentialSummaries(scenario))

try {
  const result = runCompareScript([
    '-DurationSeconds', '1',
    '-WarmupSeconds', '0',
    '-ThresholdPercent', '3',
    '-MemoryThresholdPercent', '0.5',
    '-DevCommand', 'Start-Sleep -Seconds 60',
    '-DevProcessName', 'powershell',
    '-PackagedProcessName', 'powershell',
    '-PackagedExecutablePath', systemPowerShellPath,
    '-PerfSamplerPath', harness.fakeSamplerPath,
  ])

  process.stdout.write(JSON.stringify(result))
  process.exit(0)
}
catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(message)
  process.exit(2)
}
finally {
  rmSync(harness.tempDir, { force: true, recursive: true })
}