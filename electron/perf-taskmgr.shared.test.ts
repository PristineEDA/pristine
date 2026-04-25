import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const describeOnWindows = process.platform === 'win32' ? describe : describe.skip
const repoRoot = path.resolve(__dirname, '..')
const helperPath = path.join(repoRoot, 'perf-taskmgr.shared.ps1')

type ComparisonReport = {
  Rows: Array<{
    Label: string
    DevValue: string
    PackagedValue: string
  }>
  DevNetworkAccessSummary: string
  PackagedNetworkAccessSummary: string
  CpuAbsoluteDifferencePercent: number
  MemoryWorkingSetAverageAbsoluteDifferencePercent: number
  ThresholdPercent: number
  MemoryThresholdPercent: number
  IsCpuWithinThreshold: boolean
  IsMemoryWithinThreshold: boolean
  IsWithinThreshold: boolean
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

function runPowerShellJson<T>(expression: string): T {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `. '${helperPath.replace(/'/g, "''")}'`,
    `$result = & { ${expression} }`,
    '$result | ConvertTo-Json -Depth 10 -Compress',
  ].join('; ')

  const stdout = execFileSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-Command', command],
    { encoding: 'utf8', windowsHide: true },
  )

  return JSON.parse(stdout.trim()) as T
}

function createSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    processName: 'Electron',
    durationSeconds: 30,
    sampleIntervalSeconds: 1,
    sampleCount: 30,
    observedIntervalSeconds: 29,
    cpu: {
      systemUtilityAveragePercent: 5.12,
      processUtilityAveragePercent: 0.42,
    },
    memory: {
      totalPhysicalBytes: 32 * 1024 * 1024 * 1024,
      workingSetAverageBytes: 420 * 1024 * 1024,
      workingSetPeakBytes: 512 * 1024 * 1024,
      workingSetAveragePercentOfSystemMemory: 1.28,
      workingSetPeakPercentOfSystemMemory: 1.56,
      privateBytesAverageBytes: 310 * 1024 * 1024,
      privateBytesPeakBytes: 356 * 1024 * 1024,
    },
    disk: {
      readAverageBytesPerSecond: 2048,
      readTotalBytes: 128 * 1024,
      writeAverageBytesPerSecond: 1024,
      writeTotalBytes: 64 * 1024,
    },
    network: {
      systemReceiveAverageBytesPerSecond: 4096,
      systemReceiveTotalBytes: 128 * 1024,
      systemSendAverageBytesPerSecond: 2048,
      systemSendTotalBytes: 64 * 1024,
      maxTcpConnectionCount: 3,
      maxEstablishedTcpConnectionCount: 1,
      uniqueRemoteAddressCount: 2,
      remoteAddresses: ['::1', 'api.pristine.test'],
    },
    ...overrides,
  }
}

describeOnWindows('perf task manager helper', () => {
  it('builds a multi-metric comparison report and keeps CPU threshold pass logic', () => {
    const devSummary = createSummary()
    const packagedSummary = createSummary({
      processName: 'Pristine',
      cpu: {
        systemUtilityAveragePercent: 4.95,
        processUtilityAveragePercent: 0.73,
      },
      network: {
        systemReceiveAverageBytesPerSecond: 1024,
        systemReceiveTotalBytes: 32 * 1024,
        systemSendAverageBytesPerSecond: 512,
        systemSendTotalBytes: 16 * 1024,
        maxTcpConnectionCount: 1,
        maxEstablishedTcpConnectionCount: 1,
        uniqueRemoteAddressCount: 1,
        remoteAddresses: ['api.pristine.test'],
      },
    })

    const report = runPowerShellJson<ComparisonReport>([
      `$dev = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(devSummary)}')) | ConvertFrom-Json)`,
      `$packaged = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(packagedSummary)}')) | ConvertFrom-Json)`,
      'New-PerfComparisonReport -DevSummary $dev -PackagedSummary $packaged -ThresholdPercent 3 -MemoryThresholdPercent 0.5',
    ].join('; '))

    expect(report.IsWithinThreshold).toBe(true)
    expect(report.IsCpuWithinThreshold).toBe(true)
    expect(report.IsMemoryWithinThreshold).toBe(true)
    expect(report.CpuAbsoluteDifferencePercent).toBe(0.31)
    expect(report.MemoryWorkingSetAverageAbsoluteDifferencePercent).toBe(0)
    expect(report.Rows.map((row) => row.Label)).toEqual(expect.arrayContaining([
      'CPU utility avg',
      'Memory working set avg',
      'Disk write total',
      'System net tx avg',
    ]))
    expect(report.DevNetworkAccessSummary).toContain('peak TCP 3')
    expect(report.DevNetworkAccessSummary).toContain('::1')
    expect(report.PackagedNetworkAccessSummary).toContain('api.pristine.test')
  })

  it('marks the report as failed when CPU difference exceeds the configured threshold', () => {
    const devSummary = createSummary()
    const packagedSummary = createSummary({
      processName: 'Pristine',
      cpu: {
        systemUtilityAveragePercent: 8.1,
        processUtilityAveragePercent: 4.75,
      },
    })

    const report = runPowerShellJson<ComparisonReport>([
      `$dev = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(devSummary)}')) | ConvertFrom-Json)`,
      `$packaged = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(packagedSummary)}')) | ConvertFrom-Json)`,
      'New-PerfComparisonReport -DevSummary $dev -PackagedSummary $packaged -ThresholdPercent 3 -MemoryThresholdPercent 0.5',
    ].join('; '))

    expect(report.IsWithinThreshold).toBe(false)
    expect(report.IsCpuWithinThreshold).toBe(false)
    expect(report.CpuAbsoluteDifferencePercent).toBe(4.33)
    expect(report.ThresholdPercent).toBe(3)
  })

  it('marks the report as failed when memory difference exceeds the configured threshold', () => {
    const devSummary = createSummary()
    const packagedSummary = createSummary({
      processName: 'Pristine',
      memory: {
        totalPhysicalBytes: 32 * 1024 * 1024 * 1024,
        workingSetAverageBytes: 900 * 1024 * 1024,
        workingSetPeakBytes: 980 * 1024 * 1024,
        workingSetAveragePercentOfSystemMemory: 2.75,
        workingSetPeakPercentOfSystemMemory: 2.99,
        privateBytesAverageBytes: 620 * 1024 * 1024,
        privateBytesPeakBytes: 700 * 1024 * 1024,
      },
    })

    const report = runPowerShellJson<ComparisonReport>([
      `$dev = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(devSummary)}')) | ConvertFrom-Json)`,
      `$packaged = ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeJson(packagedSummary)}')) | ConvertFrom-Json)`,
      'New-PerfComparisonReport -DevSummary $dev -PackagedSummary $packaged -ThresholdPercent 3 -MemoryThresholdPercent 0.5',
    ].join('; '))

    expect(report.IsWithinThreshold).toBe(false)
    expect(report.IsCpuWithinThreshold).toBe(true)
    expect(report.IsMemoryWithinThreshold).toBe(false)
    expect(report.MemoryWorkingSetAverageAbsoluteDifferencePercent).toBe(1.47)
    expect(report.MemoryThresholdPercent).toBe(0.5)
  })
})