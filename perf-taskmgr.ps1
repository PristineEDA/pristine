[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$ProcessName = 'Pristine',

    [Parameter(Position = 1)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$DurationSeconds = 60
)

$CoreCount = [int]$env:NUMBER_OF_PROCESSORS
$SampleIntervalSeconds = 1
$SampleCount = [Math]::Max(1, [int][Math]::Ceiling($DurationSeconds / $SampleIntervalSeconds))
$ProcessInstancePattern = if ($ProcessName.Contains('*')) {
    $ProcessName
}
else {
    "$ProcessName*"
}

$CounterPaths = @(
    '\Processor Information(_Total)\% Processor Utility',
    '\Processor Information(_Total)\% Processor Time',
    "\Process V2($ProcessInstancePattern)\% Processor Time"
)

$SystemUtilitySum = 0.0
$ProcessUtilitySum = 0.0
$CollectedSampleCount = 0

Write-Host "Starting Task Manager-style CPU utility monitor..." -ForegroundColor Gray
Write-Host "Process family: $ProcessInstancePattern" -ForegroundColor Gray
Write-Host "Monitoring duration: $DurationSeconds seconds" -ForegroundColor Gray

try {
    Get-Counter -Counter $CounterPaths -MaxSamples $SampleCount -SampleInterval $SampleIntervalSeconds -ErrorAction Stop |
    ForEach-Object {
        $systemUtilitySample = $_.CounterSamples | Where-Object {
            $_.Path -like '*\Processor Information(_Total)\% Processor Utility'
        } | Select-Object -First 1

        $systemTimeSample = $_.CounterSamples | Where-Object {
            $_.Path -like '*\Processor Information(_Total)\% Processor Time'
        } | Select-Object -First 1

        $processSamples = $_.CounterSamples | Where-Object {
            $_.InstanceName -like $ProcessInstancePattern
        }

        $systemUtility = if ($systemUtilitySample) {
            [double]$systemUtilitySample.CookedValue
        }
        else {
            0.0
        }

        $systemProcessorTime = if ($systemTimeSample) {
            [double]$systemTimeSample.CookedValue
        }
        else {
            0.0
        }

        $processAggregateTime = ($processSamples | Measure-Object -Property CookedValue -Sum).Sum
        if ($null -eq $processAggregateTime) {
            $processAggregateTime = 0.0
        }

        $processNormalizedTime = [double]$processAggregateTime / $CoreCount
        $processUtility = if ($systemProcessorTime -gt 0) {
            $systemUtility * ($processNormalizedTime / $systemProcessorTime)
        }
        else {
            0.0
        }

        $roundedSystemUtility = [Math]::Round($systemUtility, 2)
        $roundedProcessUtility = [Math]::Round($processUtility, 2)
        $time = Get-Date -Format 'HH:mm:ss'

        Write-Host "[$time] CPU Utility: $roundedSystemUtility %"
        Write-Host "[$time] $ProcessName Utility (estimated): $roundedProcessUtility %"

        $SystemUtilitySum += $roundedSystemUtility
        $ProcessUtilitySum += $roundedProcessUtility
        $CollectedSampleCount += 1
    }
}
catch {
    Write-Error "Failed to read CPU utility counters. $($_.Exception.Message)"
    return
}

Write-Host "--------------------------------" -ForegroundColor DarkGray

if ($CollectedSampleCount -gt 0) {
    $AverageSystemUtility = [Math]::Round($SystemUtilitySum / $CollectedSampleCount, 2)
    $AverageProcessUtility = [Math]::Round($ProcessUtilitySum / $CollectedSampleCount, 2)

    Write-Host "Average CPU Utility (last $DurationSeconds s): $AverageSystemUtility %"
    Write-Host "Average $ProcessName Utility (estimated, last $DurationSeconds s): $AverageProcessUtility %"
}
else {
    Write-Warning "No samples were collected during the monitoring window."
}