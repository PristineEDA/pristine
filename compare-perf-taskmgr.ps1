[CmdletBinding()]
param(
    [ValidateRange(1, [int]::MaxValue)]
    [int]$DurationSeconds = 30,

    [ValidateRange(0, [int]::MaxValue)]
    [int]$WarmupSeconds = 5,

    [ValidateRange(0.0, [double]::MaxValue)]
    [double]$ThresholdPercent = 3.0,

    [ValidateNotNullOrEmpty()]
    [string]$DevCommand = 'pnpm run dev',

    [ValidateNotNullOrEmpty()]
    [string]$DevProcessName = 'Electron',

    [ValidateNotNullOrEmpty()]
    [string]$PackagedProcessName = 'Pristine',

    [string]$PackagedExecutablePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = $PSScriptRoot
$PerfSamplerPath = Join-Path $RepoRoot 'perf-taskmgr.ps1'

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
        [int]$DurationSeconds
    )

    if (-not (Test-Path -LiteralPath $PerfSamplerPath)) {
        throw "Perf sampler script was not found at '$PerfSamplerPath'."
    }

    $maxAttempts = 3
    $pattern = '^Average .+ Utility \(estimated, last \d+ s\): (?<Average>\d+(?:\.\d+)?) %$'

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $records = @(& $PerfSamplerPath -ProcessName $ProcessName -DurationSeconds $DurationSeconds 6>&1)
            $lines = @(
                $records | ForEach-Object {
                    if ($_ -is [System.Management.Automation.InformationRecord]) {
                        [string]$_.MessageData
                    }
                    elseif ($_ -is [System.Management.Automation.ErrorRecord]) {
                        $_.ToString()
                    }
                    else {
                        [string]$_
                    }
                }
            )

            foreach ($line in $lines) {
                if (-not [string]::IsNullOrWhiteSpace($line)) {
                    Write-Host $line
                }
            }

            for ($index = $lines.Count - 1; $index -ge 0; $index--) {
                if ($lines[$index] -match $pattern) {
                    return [double]$Matches['Average']
                }
            }

            throw "Could not parse the average utility line from perf-taskmgr output for process '$ProcessName'."
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
        [int]$DurationSeconds
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

        $averageUtility = Invoke-PerfSample -ProcessName $ProcessName -DurationSeconds $DurationSeconds
        return [pscustomobject]@{
            ScenarioName = $ScenarioName
            ProcessName = $ProcessName
            AverageUtility = $averageUtility
        }
    }
    finally {
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
    $packagedExecutable = Resolve-PackagedExecutablePath -ExplicitPath $PackagedExecutablePath

    $devResult = Invoke-Scenario -ScenarioName 'Dev runtime sample' -ProcessName $DevProcessName -StartCommand $DevCommand -WorkingDirectory $RepoRoot -WarmupSeconds $WarmupSeconds -DurationSeconds $DurationSeconds
    $packagedResult = Invoke-Scenario -ScenarioName 'Packaged runtime sample' -ProcessName $PackagedProcessName -ExecutablePath $packagedExecutable -WorkingDirectory (Split-Path -Parent $packagedExecutable) -WarmupSeconds $WarmupSeconds -DurationSeconds $DurationSeconds

    $absoluteDifference = [Math]::Round([Math]::Abs($devResult.AverageUtility - $packagedResult.AverageUtility), 2)

    Write-Host '--------------------------------' -ForegroundColor DarkGray
    Write-Host ("{0,-24} {1,8} %" -f $devResult.ScenarioName, $devResult.AverageUtility)
    Write-Host ("{0,-24} {1,8} %" -f $packagedResult.ScenarioName, $packagedResult.AverageUtility)
    Write-Host ("{0,-24} {1,8} %" -f 'Absolute difference', $absoluteDifference)
    Write-Host ("{0,-24} {1,8} %" -f 'Threshold', $ThresholdPercent)

    if ($absoluteDifference -gt $ThresholdPercent) {
        Write-Error "Runtime utility difference exceeded the threshold: $absoluteDifference % > $ThresholdPercent %."
        exit 1
    }

    Write-Host 'Runtime utility difference is within the threshold.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Error $_.Exception.Message
    exit 2
}