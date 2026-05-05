import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const describeOnWindows = process.platform === 'win32' ? describe : describe.skip
const repoRoot = path.resolve(__dirname, '..')
const harnessPath = path.join(repoRoot, 'scripts', 'test-compare-perf-harness.mjs')
const harnessTimeoutMs = 15_000

type HarnessResult = {
  status: number | null
  stdout: string
  stderr: string
  artifacts: {
    comparisonErrorText: string | null
    comparisonReportJson: {
      statusMessage: string
      comparison: {
        IsWithinThreshold: boolean
      }
      dev: {
        processName: string
      }
      packaged: {
        processName: string
      }
    } | null
    comparisonReportText: string | null
    devSummaryJson: {
      processName: string
    } | null
    packagedSummaryJson: {
      processName: string
    } | null
  }
}

function createHarnessEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env }

  delete environment.NODE_OPTIONS

  for (const key of Object.keys(environment)) {
    if (key === 'VITEST' || key.startsWith('VITEST_')) {
      delete environment[key]
    }
  }

  return environment
}

function runHarness(scenario: 'pass' | 'memory-fail'): HarnessResult {
  const result = spawnSync(
    process.execPath,
    [harnessPath, scenario],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: createHarnessEnvironment(),
      windowsHide: true,
    },
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Harness exited with status ${result.status}`)
  }

  return JSON.parse(result.stdout.trim()) as HarnessResult
}

describeOnWindows('compare perf task manager script', () => {
  it('passes when both CPU and memory differences stay within threshold', () => {
    const result = runHarness('pass')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Memory absolute difference')
    expect(result.stdout).toContain('Memory threshold')
    expect(result.stdout).toContain('Runtime CPU and memory differences are within the threshold.')
    expect(result.stderr).toBe('')
  }, harnessTimeoutMs)

  it('writes detailed comparison artifacts for upload workflows', () => {
    const result = runHarness('pass')

    expect(result.artifacts.devSummaryJson?.processName).toBe('dev-cscript')
    expect(result.artifacts.packagedSummaryJson?.processName).toBe('packaged-wscript')
    expect(result.artifacts.comparisonReportJson?.dev.processName).toBe('cscript')
    expect(result.artifacts.comparisonReportJson?.packaged.processName).toBe('wscript')
    expect(result.artifacts.comparisonReportJson?.comparison.IsWithinThreshold).toBe(true)
    expect(result.artifacts.comparisonReportJson?.statusMessage).toContain('within the threshold')
    expect(result.artifacts.comparisonReportText).toContain('CPU absolute difference')
    expect(result.artifacts.comparisonReportText).toContain('Memory threshold')
    expect(result.artifacts.comparisonErrorText).toBeNull()
  }, harnessTimeoutMs)

  it('fails when memory difference exceeds the configured threshold even if CPU stays within threshold', () => {
    const result = runHarness('memory-fail')

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Memory absolute difference')
    expect(result.stderr).toContain('Runtime thresholds exceeded.')
    expect(result.stderr).toContain('Memory working set')
    expect(result.stderr).toContain('exceeded the threshold')
    expect(result.artifacts.comparisonReportJson?.comparison.IsWithinThreshold).toBe(false)
    expect(result.artifacts.comparisonReportJson?.statusMessage).toContain('Runtime thresholds exceeded.')
  }, harnessTimeoutMs)
})