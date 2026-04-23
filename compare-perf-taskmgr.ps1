[CmdletBinding()]
param(
    [ValidateRange(1, [int]::MaxValue)]
    [int]$DurationSeconds = 30,

    [ValidateRange(0, [int]::MaxValue)]
    [int]$WarmupSeconds = 5,

    [ValidateRange(0.0, [double]::MaxValue)]
    [double]$ThresholdPercent = 3.0,

    [ValidateRange(0.0, [double]::MaxValue)]
    [double]$MemoryThresholdPercent = 0.5,

    [ValidateNotNullOrEmpty()]
    [string]$DevCommand = 'pnpm run dev',

    [ValidateNotNullOrEmpty()]
    [string]$DevProcessName = 'Electron',

    [ValidateNotNullOrEmpty()]
    [string]$PackagedProcessName = 'Pristine',

    [string]$PackagedExecutablePath,

    [string]$PerfSamplerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = $PSScriptRoot
$DefaultPerfSamplerPath = Join-Path $RepoRoot 'perf-taskmgr.ps1'
$HelperPath = Join-Path $RepoRoot 'perf-taskmgr.shared.ps1'

if (-not (Test-Path -LiteralPath $HelperPath)) {
    throw "Perf helper script was not found at '$HelperPath'."
}

. $HelperPath

function Resolve-PerfSamplerPath {
    param(
        [string]$ExplicitPath
    )

    $candidatePath = if ([string]::IsNullOrWhiteSpace($ExplicitPath)) {
        $DefaultPerfSamplerPath
    }
    else {
        $ExplicitPath
    }

    if (-not (Test-Path -LiteralPath $candidatePath)) {
        throw "Perf sampler script was not found at '$candidatePath'."
    }

    return (Resolve-Path -LiteralPath $candidatePath).Path
}

function Stop-PristineProcesses {
    Get-Process Pristine, Electron -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq 'node.exe' -and
            $_.CommandLine -like '*pnpm*dev*'
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

function Normalize-ProcessFamilyName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName
    )

    if ($ProcessName.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
        return $ProcessName.Substring(0, $ProcessName.Length - 4)
    }

    return $ProcessName
}

function Stop-ProcessFamily {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [int[]]$ExcludeProcessIds = @(),

        [ValidateRange(0, [int]::MaxValue)]
        [int]$GracefulTimeoutSeconds = 5
    )

    $resolvedProcessName = Normalize-ProcessFamilyName -ProcessName $ProcessName
    $excludedProcessIds = [System.Collections.Generic.HashSet[int]]::new()

    foreach ($excludedProcessId in @($ExcludeProcessIds)) {
        [void]$excludedProcessIds.Add([int]$excludedProcessId)
    }

    $matchingProcesses = @(
        Get-Process -Name $resolvedProcessName -ErrorAction SilentlyContinue |
            Where-Object { -not $excludedProcessIds.Contains([int]$_.Id) }
    )

    if ($matchingProcesses.Count -eq 0) {
        return
    }

    $requestedGracefulClose = $false

    foreach ($process in $matchingProcesses) {
        try {
            if (-not $process.HasExited) {
                $requestedGracefulClose = $process.CloseMainWindow() -or $requestedGracefulClose
            }
        }
        catch {
        }
    }

    if ($requestedGracefulClose -and $GracefulTimeoutSeconds -gt 0) {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        while ($stopwatch.Elapsed.TotalSeconds -lt $GracefulTimeoutSeconds) {
            $remainingProcesses = @(
                Get-Process -Name $resolvedProcessName -ErrorAction SilentlyContinue |
                    Where-Object { -not $excludedProcessIds.Contains([int]$_.Id) }
            )

            if ($remainingProcesses.Count -eq 0) {
                return
            }

            Start-Sleep -Milliseconds 250
        }
    }

    Get-Process -Name $resolvedProcessName -ErrorAction SilentlyContinue |
        Where-Object { -not $excludedProcessIds.Contains([int]$_.Id) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Write-PerfScriptError {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    [Console]::Error.WriteLine($Message)
}

function Wait-ForProcessFamily {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [ValidateRange(1, [int]::MaxValue)]
        [int]$TimeoutSeconds = 120
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        if (Get-Process -Name $ProcessName -ErrorAction SilentlyContinue) {
            return $true
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Resolve-PackagedExecutablePath {
    param(
        [string]$ExplicitPath
    )

    if ($ExplicitPath) {
        if (-not (Test-Path -LiteralPath $ExplicitPath)) {
            throw "Packaged executable was not found at '$ExplicitPath'."
        }

        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }

    $releaseRoot = Join-Path $RepoRoot 'release'
    $releaseDirectories = Get-ChildItem -Path $releaseRoot -Directory -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending

    foreach ($directory in $releaseDirectories) {
        $candidatePath = Join-Path $directory.FullName 'win-unpacked\Pristine.exe'
        if (Test-Path -LiteralPath $candidatePath) {
            return $candidatePath
        }
    }

    throw "Could not find a packaged executable under '$releaseRoot'. Run 'pnpm run package:win' first or pass -PackagedExecutablePath."
}

function Invoke-PerfSample {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [ValidateRange(1, [int]::MaxValue)]
        [int]$DurationSeconds,

        [Parameter(Mandatory = $true)]
        [string]$PerfSamplerScriptPath
    )

    $maxAttempts = 3

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $records = @(& $PerfSamplerScriptPath -ProcessName $ProcessName -DurationSeconds $DurationSeconds -OutputFormat Json 2>&1)
            $jsonText = (($records | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
            return ConvertFrom-PerfSummaryJsonText -JsonText $jsonText
        }
        catch {
            if ($attempt -ge $maxAttempts) {
                throw
            }

            Write-Host "Retrying perf sample after transient counter error ($attempt/$maxAttempts)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }

    throw "Perf sampling exhausted all retry attempts for process '$ProcessName'."
}

function Invoke-Scenario {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScenarioName,

        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [string]$StartCommand,

        [string]$ExecutablePath,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [ValidateRange(0, [int]::MaxValue)]
        [int]$WarmupSeconds,

        [ValidateRange(1, [int]::MaxValue)]
        [int]$DurationSeconds,

        [Parameter(Mandatory = $true)]
        [string]$PerfSamplerScriptPath
    )

    $launcher = $null

    try {
        Stop-PristineProcesses
        Write-Host "=== $ScenarioName ===" -ForegroundColor Cyan

        if ($StartCommand) {
            $launcher = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $WorkingDirectory -ArgumentList @(
                '-NoLogo',
                '-NoProfile',
                '-Command',
                $StartCommand
            ) -PassThru
        }
        else {
            $launcher = Start-Process -FilePath $ExecutablePath -WorkingDirectory $WorkingDirectory -PassThru
        }

        if (-not (Wait-ForProcessFamily -ProcessName $ProcessName)) {
            throw "Timed out waiting for process '$ProcessName' during scenario '$ScenarioName'."
        }

        if ($WarmupSeconds -gt 0) {
            Write-Host "Warmup: $WarmupSeconds seconds" -ForegroundColor Gray
            Start-Sleep -Seconds $WarmupSeconds
        }

        $summary = Invoke-PerfSample -ProcessName $ProcessName -DurationSeconds $DurationSeconds -PerfSamplerScriptPath $PerfSamplerScriptPath
        return [pscustomobject]@{
            ScenarioName = $ScenarioName
            ProcessName = $ProcessName
            Summary = $summary
        }
    }
    finally {
        Stop-ProcessFamily -ProcessName $ProcessName -ExcludeProcessIds @($PID)

        if ($launcher) {
            try {
                if (-not $launcher.HasExited) {
                    Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue
                }
            }
            catch {
            }
        }

        Stop-PristineProcesses
    }
}

try {
    $resolvedPerfSamplerPath = Resolve-PerfSamplerPath -ExplicitPath $PerfSamplerPath
    $packagedExecutable = Resolve-PackagedExecutablePath -ExplicitPath $PackagedExecutablePath

    $devResult = Invoke-Scenario -ScenarioName 'Dev runtime sample' -ProcessName $DevProcessName -StartCommand $DevCommand -WorkingDirectory $RepoRoot -WarmupSeconds $WarmupSeconds -DurationSeconds $DurationSeconds -PerfSamplerScriptPath $resolvedPerfSamplerPath
    $packagedResult = Invoke-Scenario -ScenarioName 'Packaged runtime sample' -ProcessName $PackagedProcessName -ExecutablePath $packagedExecutable -WorkingDirectory (Split-Path -Parent $packagedExecutable) -WarmupSeconds $WarmupSeconds -DurationSeconds $DurationSeconds -PerfSamplerScriptPath $resolvedPerfSamplerPath

    $report = New-PerfComparisonReport -DevSummary $devResult.Summary -PackagedSummary $packagedResult.Summary -ThresholdPercent $ThresholdPercent -MemoryThresholdPercent $MemoryThresholdPercent

    Write-Host '--------------------------------' -ForegroundColor DarkGray
    Write-Host ('{0,-28} {1,-30} {2,-30}' -f 'Metric', 'Dev', 'Packaged')
    Write-Host ('{0,-28} {1,-30} {2,-30}' -f '------', '---', '--------')
    foreach ($row in @($report.Rows)) {
        Write-Host ('{0,-28} {1,-30} {2,-30}' -f $row.Label, $row.DevValue, $row.PackagedValue)
    }

    Write-Host ('{0,-28} {1}' -f 'Network access (dev)', $report.DevNetworkAccessSummary)
    Write-Host ('{0,-28} {1}' -f 'Network access (packaged)', $report.PackagedNetworkAccessSummary)
    Write-Host ('{0,-28} {1}' -f 'CPU absolute difference', (Format-PerfPercent -Percent $report.CpuAbsoluteDifferencePercent))
    Write-Host ('{0,-28} {1}' -f 'CPU threshold', (Format-PerfPercent -Percent $report.ThresholdPercent))
    Write-Host ('{0,-28} {1}' -f 'Memory absolute difference', (Format-PerfPercent -Percent $report.MemoryWorkingSetAverageAbsoluteDifferencePercent))
    Write-Host ('{0,-28} {1}' -f 'Memory threshold', (Format-PerfPercent -Percent $report.MemoryThresholdPercent))

    if (-not $report.IsWithinThreshold) {
        $thresholdFailures = @()

        if (-not $report.IsCpuWithinThreshold) {
            $thresholdFailures += "CPU utility difference exceeded the threshold: $($report.CpuAbsoluteDifferencePercent) % > $($report.ThresholdPercent) %."
        }

        if (-not $report.IsMemoryWithinThreshold) {
            $thresholdFailures += "Memory working set difference exceeded the threshold: $($report.MemoryWorkingSetAverageAbsoluteDifferencePercent) % > $($report.MemoryThresholdPercent) %."
        }

        Write-PerfScriptError -Message ('Runtime thresholds exceeded. ' + ($thresholdFailures -join ' '))
        exit 1
    }

    Write-Host 'Runtime CPU and memory differences are within the threshold.' -ForegroundColor Green
    exit 0
}
catch {
    Write-PerfScriptError -Message $_.Exception.Message
    exit 2
}