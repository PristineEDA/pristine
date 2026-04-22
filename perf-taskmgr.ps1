[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$ProcessName = 'Pristine',

    [Parameter(Position = 1)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$DurationSeconds = 60,

    [ValidateSet('Text', 'Json')]
    [string]$OutputFormat = 'Text'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$HelperPath = Join-Path $PSScriptRoot 'perf-taskmgr.shared.ps1'
if (-not (Test-Path -LiteralPath $HelperPath)) {
    throw "Perf helper script was not found at '$HelperPath'."
}

. $HelperPath

$CoreCount = [Math]::Max(1, [int]$env:NUMBER_OF_PROCESSORS)
$SampleIntervalSeconds = 1
$SampleCount = [Math]::Max(1, [int][Math]::Ceiling($DurationSeconds / $SampleIntervalSeconds))
$ProcessInstancePattern = if ($ProcessName.Contains('*')) {
    $ProcessName
}
else {
    "$ProcessName*"
}

$ProcessNamePattern = if ($ProcessName.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
    $ProcessName.Substring(0, $ProcessName.Length - 4)
}
else {
    $ProcessName
}

$CounterPaths = @(
    '\Processor Information(_Total)\% Processor Utility',
    '\Processor Information(_Total)\% Processor Time',
    "\Process V2($ProcessInstancePattern)\% Processor Time",
    '\Network Interface(*)\Bytes Received/sec',
    '\Network Interface(*)\Bytes Sent/sec'
)

function Test-ProcessFamilyMatch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidateName,

        [Parameter(Mandatory = $true)]
        [string]$NamePattern
    )

    $normalizedCandidateName = if ($CandidateName.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
        $CandidateName.Substring(0, $CandidateName.Length - 4)
    }
    else {
        $CandidateName
    }

    return ($normalizedCandidateName -like $NamePattern)
}

function Get-FirstCounterCookedValue {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$CounterSamples,

        [Parameter(Mandatory = $true)]
        [string]$PathPattern
    )

    $sample = $CounterSamples |
        Where-Object { $_.Path -like $PathPattern } |
        Select-Object -First 1

    if ($null -eq $sample) {
        return 0.0
    }

    return [double]$sample.CookedValue
}

function Get-AggregatedCounterCookedValueByInstance {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$CounterSamples,

        [Parameter(Mandatory = $true)]
        [string]$InstancePattern
    )

    $aggregate = ($CounterSamples |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace($_.InstanceName) -and
            $_.InstanceName -like $InstancePattern
        } |
        Measure-Object -Property CookedValue -Sum).Sum

    if ($null -eq $aggregate) {
        return 0.0
    }

    return [double]$aggregate
}

function Get-AggregatedCounterCookedValueByPath {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$CounterSamples,

        [Parameter(Mandatory = $true)]
        [string]$PathPattern
    )

    $aggregate = ($CounterSamples |
        Where-Object {
            $_.Path -like $PathPattern -and
            $_.InstanceName -ne '_Total'
        } |
        Measure-Object -Property CookedValue -Sum).Sum

    if ($null -eq $aggregate) {
        return 0.0
    }

    return [double]$aggregate
}

function Get-TotalPhysicalMemoryBytes {
    try {
        $computerSystem = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
        if ($null -eq $computerSystem.TotalPhysicalMemory) {
            return 0.0
        }

        return [double]$computerSystem.TotalPhysicalMemory
    }
    catch {
        return 0.0
    }
}

function Get-ProcessFamilySnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NamePattern
    )

    $matchingProcesses = @(
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                Test-ProcessFamilyMatch -CandidateName $_.Name -NamePattern $NamePattern
            }
    )

    if ($matchingProcesses.Count -eq 0) {
        return [pscustomobject]@{
            ProcessIds = @()
            WorkingSetBytes = 0.0
            PrivateBytes = 0.0
            ReadTransferBytes = 0.0
            WriteTransferBytes = 0.0
        }
    }

    $processIds = @($matchingProcesses | ForEach-Object { [int]$_.ProcessId })

    return [pscustomobject]@{
        ProcessIds = $processIds
        WorkingSetBytes = [double](($matchingProcesses | Measure-Object -Property WorkingSetSize -Sum).Sum)
        PrivateBytes = [double](($matchingProcesses | Measure-Object -Property PrivatePageCount -Sum).Sum)
        ReadTransferBytes = [double](($matchingProcesses | Measure-Object -Property ReadTransferCount -Sum).Sum)
        WriteTransferBytes = [double](($matchingProcesses | Measure-Object -Property WriteTransferCount -Sum).Sum)
    }
}

function Get-ProcessFamilyTcpNetworkSnapshot {
    param(
        [int[]]$ProcessIds
    )

    if ($null -eq $ProcessIds -or $ProcessIds.Count -eq 0) {
        return [pscustomobject]@{
            ConnectionCount = 0
            EstablishedConnectionCount = 0
            RemoteAddresses = @()
        }
    }

    try {
        $processIdLookup = [System.Collections.Generic.HashSet[int]]::new()
        foreach ($processId in $ProcessIds) {
            [void]$processIdLookup.Add([int]$processId)
        }

        $connections = @(
            Get-NetTCPConnection -ErrorAction Stop |
                Where-Object { $processIdLookup.Contains([int]$_.OwningProcess) }
        )

        $remoteAddresses = @(
            $connections |
                Where-Object {
                    -not [string]::IsNullOrWhiteSpace($_.RemoteAddress) -and
                    $_.RemoteAddress -notin @('0.0.0.0', '::')
                } |
                Select-Object -ExpandProperty RemoteAddress -Unique |
                Sort-Object
        )

        return [pscustomobject]@{
            ConnectionCount = $connections.Count
            EstablishedConnectionCount = @($connections | Where-Object { $_.State -eq 'Established' }).Count
            RemoteAddresses = $remoteAddresses
        }
    }
    catch {
        return [pscustomobject]@{
            ConnectionCount = 0
            EstablishedConnectionCount = 0
            RemoteAddresses = @()
        }
    }
}

$SystemUtilitySum = 0.0
$ProcessUtilitySum = 0.0
$WorkingSetBytesSum = 0.0
$PrivateBytesSum = 0.0
$WorkingSetPeakBytes = 0.0
$PrivateBytesPeakBytes = 0.0
$DiskReadTotalBytes = 0.0
$DiskWriteTotalBytes = 0.0
$SystemReceiveBytesPerSecondSum = 0.0
$SystemSendBytesPerSecondSum = 0.0
$CollectedSampleCount = 0

$TotalPhysicalMemoryBytes = Get-TotalPhysicalMemoryBytes
$ObservedRemoteAddresses = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$MaxTcpConnectionCount = 0
$MaxEstablishedTcpConnectionCount = 0
$PreviousProcessSnapshot = $null
$PreviousSampleTimestamp = $null
$ObservedIntervalSeconds = 0.0

if ($OutputFormat -eq 'Text') {
    Write-Host 'Starting Task Manager-style runtime monitor...' -ForegroundColor Gray
    Write-Host "Process family: $ProcessInstancePattern" -ForegroundColor Gray
    Write-Host "Monitoring duration: $DurationSeconds seconds" -ForegroundColor Gray
}

try {
    for ($sampleIndex = 0; $sampleIndex -lt $SampleCount; $sampleIndex++) {
        $sampleTimestamp = Get-Date
        $counterSnapshot = Get-Counter -Counter $CounterPaths -ErrorAction Stop
        $counterSamples = @($counterSnapshot.CounterSamples)
        $processSnapshot = Get-ProcessFamilySnapshot -NamePattern $ProcessNamePattern
        $tcpSnapshot = Get-ProcessFamilyTcpNetworkSnapshot -ProcessIds $processSnapshot.ProcessIds

        $systemUtility = Get-FirstCounterCookedValue -CounterSamples $counterSamples -PathPattern '*\Processor Information(_Total)\% Processor Utility'
        $systemProcessorTime = Get-FirstCounterCookedValue -CounterSamples $counterSamples -PathPattern '*\Processor Information(_Total)\% Processor Time'
        $processAggregateTime = Get-AggregatedCounterCookedValueByInstance -CounterSamples $counterSamples -InstancePattern $ProcessInstancePattern

        $processNormalizedTime = [double]$processAggregateTime / $CoreCount
        $processUtility = if ($systemProcessorTime -gt 0) {
            $systemUtility * ($processNormalizedTime / $systemProcessorTime)
        }
        else {
            0.0
        }

        $systemReceiveBytesPerSecond = Get-AggregatedCounterCookedValueByPath -CounterSamples $counterSamples -PathPattern '*\Network Interface(*)\Bytes Received/sec'
        $systemSendBytesPerSecond = Get-AggregatedCounterCookedValueByPath -CounterSamples $counterSamples -PathPattern '*\Network Interface(*)\Bytes Sent/sec'

        $currentReadBytesPerSecond = 0.0
        $currentWriteBytesPerSecond = 0.0

        if ($null -ne $PreviousProcessSnapshot -and $null -ne $PreviousSampleTimestamp) {
            $intervalSeconds = [Math]::Max(0.001, ($sampleTimestamp - $PreviousSampleTimestamp).TotalSeconds)
            $ObservedIntervalSeconds += $intervalSeconds

            $readDeltaBytes = [Math]::Max(0.0, $processSnapshot.ReadTransferBytes - $PreviousProcessSnapshot.ReadTransferBytes)
            $writeDeltaBytes = [Math]::Max(0.0, $processSnapshot.WriteTransferBytes - $PreviousProcessSnapshot.WriteTransferBytes)

            $DiskReadTotalBytes += $readDeltaBytes
            $DiskWriteTotalBytes += $writeDeltaBytes
            $currentReadBytesPerSecond = $readDeltaBytes / $intervalSeconds
            $currentWriteBytesPerSecond = $writeDeltaBytes / $intervalSeconds
        }

        $WorkingSetBytesSum += $processSnapshot.WorkingSetBytes
        $PrivateBytesSum += $processSnapshot.PrivateBytes
        $WorkingSetPeakBytes = [Math]::Max($WorkingSetPeakBytes, $processSnapshot.WorkingSetBytes)
        $PrivateBytesPeakBytes = [Math]::Max($PrivateBytesPeakBytes, $processSnapshot.PrivateBytes)
        $SystemUtilitySum += $systemUtility
        $ProcessUtilitySum += $processUtility
        $SystemReceiveBytesPerSecondSum += $systemReceiveBytesPerSecond
        $SystemSendBytesPerSecondSum += $systemSendBytesPerSecond
        $CollectedSampleCount += 1
        $MaxTcpConnectionCount = [Math]::Max($MaxTcpConnectionCount, [int]$tcpSnapshot.ConnectionCount)
        $MaxEstablishedTcpConnectionCount = [Math]::Max($MaxEstablishedTcpConnectionCount, [int]$tcpSnapshot.EstablishedConnectionCount)

        foreach ($remoteAddress in @($tcpSnapshot.RemoteAddresses)) {
            if (-not [string]::IsNullOrWhiteSpace($remoteAddress)) {
                [void]$ObservedRemoteAddresses.Add([string]$remoteAddress)
            }
        }

        if ($OutputFormat -eq 'Text') {
            $time = $sampleTimestamp.ToString('HH:mm:ss')
            Write-Host (
                '[{0}] CPU: system {1}; {2} {3}; Working Set: {4}; Disk R/W: {5} / {6}; TCP: {7} (established {8})' -f
                    $time,
                    (Format-PerfPercent -Percent ([Math]::Round($systemUtility, 2))),
                    $ProcessName,
                    (Format-PerfPercent -Percent ([Math]::Round($processUtility, 2))),
                    (Format-PerfBytes -Bytes $processSnapshot.WorkingSetBytes),
                    (Format-PerfRate -BytesPerSecond $currentReadBytesPerSecond),
                    (Format-PerfRate -BytesPerSecond $currentWriteBytesPerSecond),
                    [int]$tcpSnapshot.ConnectionCount,
                    [int]$tcpSnapshot.EstablishedConnectionCount
            )
        }

        $PreviousProcessSnapshot = $processSnapshot
        $PreviousSampleTimestamp = $sampleTimestamp

        if ($sampleIndex -lt ($SampleCount - 1)) {
            Start-Sleep -Seconds $SampleIntervalSeconds
        }
    }
}
catch {
    Write-Error "Failed to read CPU utility counters. $($_.Exception.Message)"
    return
}

if ($CollectedSampleCount -le 0) {
    throw 'No samples were collected during the monitoring window.'
}

$AverageSystemUtility = [Math]::Round($SystemUtilitySum / $CollectedSampleCount, 2)
$AverageProcessUtility = [Math]::Round($ProcessUtilitySum / $CollectedSampleCount, 2)
$AverageWorkingSetBytes = [Math]::Round($WorkingSetBytesSum / $CollectedSampleCount, 2)
$AveragePrivateBytes = [Math]::Round($PrivateBytesSum / $CollectedSampleCount, 2)
$AverageWorkingSetPercent = if ($TotalPhysicalMemoryBytes -gt 0) {
    [Math]::Round(($AverageWorkingSetBytes / $TotalPhysicalMemoryBytes) * 100.0, 2)
}
else {
    0.0
}

$PeakWorkingSetPercent = if ($TotalPhysicalMemoryBytes -gt 0) {
    [Math]::Round(($WorkingSetPeakBytes / $TotalPhysicalMemoryBytes) * 100.0, 2)
}
else {
    0.0
}

$AverageDiskReadBytesPerSecond = if ($ObservedIntervalSeconds -gt 0) {
    [Math]::Round($DiskReadTotalBytes / $ObservedIntervalSeconds, 2)
}
else {
    0.0
}

$AverageDiskWriteBytesPerSecond = if ($ObservedIntervalSeconds -gt 0) {
    [Math]::Round($DiskWriteTotalBytes / $ObservedIntervalSeconds, 2)
}
else {
    0.0
}

$AverageSystemReceiveBytesPerSecond = [Math]::Round($SystemReceiveBytesPerSecondSum / $CollectedSampleCount, 2)
$AverageSystemSendBytesPerSecond = [Math]::Round($SystemSendBytesPerSecondSum / $CollectedSampleCount, 2)
$SystemReceiveTotalBytes = [Math]::Round($AverageSystemReceiveBytesPerSecond * $DurationSeconds, 2)
$SystemSendTotalBytes = [Math]::Round($AverageSystemSendBytesPerSecond * $DurationSeconds, 2)
$ObservedRemoteAddressList = @($ObservedRemoteAddresses | Sort-Object)

$summary = [pscustomobject]@{
    processName = $ProcessName
    durationSeconds = $DurationSeconds
    sampleIntervalSeconds = $SampleIntervalSeconds
    sampleCount = $CollectedSampleCount
    observedIntervalSeconds = [Math]::Round($ObservedIntervalSeconds, 2)
    cpu = [pscustomobject]@{
        systemUtilityAveragePercent = $AverageSystemUtility
        processUtilityAveragePercent = $AverageProcessUtility
    }
    memory = [pscustomobject]@{
        totalPhysicalBytes = [Math]::Round($TotalPhysicalMemoryBytes, 2)
        workingSetAverageBytes = $AverageWorkingSetBytes
        workingSetPeakBytes = [Math]::Round($WorkingSetPeakBytes, 2)
        workingSetAveragePercentOfSystemMemory = $AverageWorkingSetPercent
        workingSetPeakPercentOfSystemMemory = $PeakWorkingSetPercent
        privateBytesAverageBytes = $AveragePrivateBytes
        privateBytesPeakBytes = [Math]::Round($PrivateBytesPeakBytes, 2)
    }
    disk = [pscustomobject]@{
        readAverageBytesPerSecond = $AverageDiskReadBytesPerSecond
        readTotalBytes = [Math]::Round($DiskReadTotalBytes, 2)
        writeAverageBytesPerSecond = $AverageDiskWriteBytesPerSecond
        writeTotalBytes = [Math]::Round($DiskWriteTotalBytes, 2)
    }
    network = [pscustomobject]@{
        systemReceiveAverageBytesPerSecond = $AverageSystemReceiveBytesPerSecond
        systemReceiveTotalBytes = $SystemReceiveTotalBytes
        systemSendAverageBytesPerSecond = $AverageSystemSendBytesPerSecond
        systemSendTotalBytes = $SystemSendTotalBytes
        maxTcpConnectionCount = $MaxTcpConnectionCount
        maxEstablishedTcpConnectionCount = $MaxEstablishedTcpConnectionCount
        uniqueRemoteAddressCount = $ObservedRemoteAddressList.Count
        remoteAddresses = $ObservedRemoteAddressList
    }
}

if ($OutputFormat -eq 'Json') {
    $summary | ConvertTo-Json -Depth 10 -Compress
    return
}

Write-Host '--------------------------------' -ForegroundColor DarkGray
Write-Host "Average CPU Utility (last $DurationSeconds s): $AverageSystemUtility %"
Write-Host "Average $ProcessName Utility (estimated, last $DurationSeconds s): $AverageProcessUtility %"
Write-Host ('Average Working Set (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.memory.workingSetAverageBytes))
Write-Host ('Peak Working Set (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.memory.workingSetPeakBytes))
Write-Host ('Average Private Bytes (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.memory.privateBytesAverageBytes))
Write-Host ('Peak Private Bytes (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.memory.privateBytesPeakBytes))
Write-Host ('Average Disk Read (last {0} s): {1}' -f $DurationSeconds, (Format-PerfRate -BytesPerSecond $summary.disk.readAverageBytesPerSecond))
Write-Host ('Average Disk Write (last {0} s): {1}' -f $DurationSeconds, (Format-PerfRate -BytesPerSecond $summary.disk.writeAverageBytesPerSecond))
Write-Host ('Total Disk Read (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.disk.readTotalBytes))
Write-Host ('Total Disk Write (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.disk.writeTotalBytes))
Write-Host ('Average System Network Rx (last {0} s): {1}' -f $DurationSeconds, (Format-PerfRate -BytesPerSecond $summary.network.systemReceiveAverageBytesPerSecond))
Write-Host ('Average System Network Tx (last {0} s): {1}' -f $DurationSeconds, (Format-PerfRate -BytesPerSecond $summary.network.systemSendAverageBytesPerSecond))
Write-Host ('Total System Network Rx (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.network.systemReceiveTotalBytes))
Write-Host ('Total System Network Tx (last {0} s): {1}' -f $DurationSeconds, (Format-PerfBytes -Bytes $summary.network.systemSendTotalBytes))
Write-Host ('Network Access Summary: {0}' -f (Format-PerfNetworkAccessSummary -NetworkSummary $summary.network))