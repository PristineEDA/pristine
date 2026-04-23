Set-StrictMode -Version Latest

function Format-PerfBytes {
    param(
        [AllowNull()]
        [object]$Bytes
    )

    if ($null -eq $Bytes) {
        return 'n/a'
    }

    $normalizedBytes = [Math]::Max(0.0, [double]$Bytes)
    $units = @('B', 'KiB', 'MiB', 'GiB', 'TiB')
    $value = $normalizedBytes
    $unitIndex = 0

    while ($value -ge 1024.0 -and $unitIndex -lt ($units.Count - 1)) {
        $value /= 1024.0
        $unitIndex += 1
    }

    if ($unitIndex -eq 0) {
        return ('{0:N0} {1}' -f $value, $units[$unitIndex])
    }

    return ('{0:N2} {1}' -f $value, $units[$unitIndex])
}

function Format-PerfRate {
    param(
        [AllowNull()]
        [object]$BytesPerSecond
    )

    return ('{0}/s' -f (Format-PerfBytes -Bytes $BytesPerSecond))
}

function Format-PerfPercent {
    param(
        [AllowNull()]
        [object]$Percent
    )

    if ($null -eq $Percent) {
        return 'n/a'
    }

    return ('{0:N2} %' -f ([double]$Percent))
}

function ConvertFrom-PerfSummaryJsonText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$JsonText
    )

    if ([string]::IsNullOrWhiteSpace($JsonText)) {
        throw 'Perf sampler returned empty JSON output.'
    }

    try {
        return ($JsonText | ConvertFrom-Json)
    }
    catch {
        throw "Perf sampler returned invalid JSON output. $($_.Exception.Message)"
    }
}

function Format-PerfNetworkAccessSummary {
    param(
        [AllowNull()]
        [object]$NetworkSummary
    )

    if ($null -eq $NetworkSummary) {
        return 'no network data'
    }

    $remoteAddresses = @()
    if ($null -ne $NetworkSummary.remoteAddresses) {
        $remoteAddresses = @(
            $NetworkSummary.remoteAddresses |
                ForEach-Object { [string]$_ } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                Sort-Object -Unique
        )
    }

    $preview = @($remoteAddresses | Select-Object -First 5)
    $summary = 'peak TCP {0}, peak established {1}, unique remotes {2}' -f 
        [int]$NetworkSummary.maxTcpConnectionCount,
        [int]$NetworkSummary.maxEstablishedTcpConnectionCount,
        [int]$NetworkSummary.uniqueRemoteAddressCount

    if ($preview.Count -eq 0) {
        return $summary
    }

    $summary += '; remotes: ' + ($preview -join ', ')

    if ($remoteAddresses.Count -gt $preview.Count) {
        $summary += ' (+' + ($remoteAddresses.Count - $preview.Count) + ' more)'
    }

    return $summary
}

function New-PerfComparisonRow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string]$DevValue,

        [Parameter(Mandatory = $true)]
        [string]$PackagedValue
    )

    return [pscustomobject]@{
        Label = $Label
        DevValue = $DevValue
        PackagedValue = $PackagedValue
    }
}

function New-PerfComparisonReport {
    param(
        [Parameter(Mandatory = $true)]
        [object]$DevSummary,

        [Parameter(Mandatory = $true)]
        [object]$PackagedSummary,

        [ValidateRange(0.0, [double]::MaxValue)]
        [double]$ThresholdPercent,

        [ValidateRange(0.0, [double]::MaxValue)]
        [double]$MemoryThresholdPercent
    )

    $cpuAbsoluteDifference = [Math]::Round(
        [Math]::Abs(
            ([double]$DevSummary.cpu.processUtilityAveragePercent) -
            ([double]$PackagedSummary.cpu.processUtilityAveragePercent)
        ),
        2
    )

    $memoryWorkingSetAverageAbsoluteDifference = [Math]::Round(
        [Math]::Abs(
            ([double]$DevSummary.memory.workingSetAveragePercentOfSystemMemory) -
            ([double]$PackagedSummary.memory.workingSetAveragePercentOfSystemMemory)
        ),
        2
    )

    $isCpuWithinThreshold = ($cpuAbsoluteDifference -le $ThresholdPercent)
    $isMemoryWithinThreshold = ($memoryWorkingSetAverageAbsoluteDifference -le $MemoryThresholdPercent)

    $rows = @(
        (New-PerfComparisonRow -Label 'CPU utility avg' -DevValue (Format-PerfPercent -Percent $DevSummary.cpu.processUtilityAveragePercent) -PackagedValue (Format-PerfPercent -Percent $PackagedSummary.cpu.processUtilityAveragePercent)),
        (New-PerfComparisonRow -Label 'Memory working set avg' -DevValue ('{0} ({1} of RAM)' -f (Format-PerfBytes -Bytes $DevSummary.memory.workingSetAverageBytes), (Format-PerfPercent -Percent $DevSummary.memory.workingSetAveragePercentOfSystemMemory)) -PackagedValue ('{0} ({1} of RAM)' -f (Format-PerfBytes -Bytes $PackagedSummary.memory.workingSetAverageBytes), (Format-PerfPercent -Percent $PackagedSummary.memory.workingSetAveragePercentOfSystemMemory))),
        (New-PerfComparisonRow -Label 'Memory working set peak' -DevValue ('{0} ({1} of RAM)' -f (Format-PerfBytes -Bytes $DevSummary.memory.workingSetPeakBytes), (Format-PerfPercent -Percent $DevSummary.memory.workingSetPeakPercentOfSystemMemory)) -PackagedValue ('{0} ({1} of RAM)' -f (Format-PerfBytes -Bytes $PackagedSummary.memory.workingSetPeakBytes), (Format-PerfPercent -Percent $PackagedSummary.memory.workingSetPeakPercentOfSystemMemory))),
        (New-PerfComparisonRow -Label 'Memory private bytes avg' -DevValue (Format-PerfBytes -Bytes $DevSummary.memory.privateBytesAverageBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.memory.privateBytesAverageBytes)),
        (New-PerfComparisonRow -Label 'Memory private bytes peak' -DevValue (Format-PerfBytes -Bytes $DevSummary.memory.privateBytesPeakBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.memory.privateBytesPeakBytes)),
        (New-PerfComparisonRow -Label 'Disk read avg' -DevValue (Format-PerfRate -BytesPerSecond $DevSummary.disk.readAverageBytesPerSecond) -PackagedValue (Format-PerfRate -BytesPerSecond $PackagedSummary.disk.readAverageBytesPerSecond)),
        (New-PerfComparisonRow -Label 'Disk read total' -DevValue (Format-PerfBytes -Bytes $DevSummary.disk.readTotalBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.disk.readTotalBytes)),
        (New-PerfComparisonRow -Label 'Disk write avg' -DevValue (Format-PerfRate -BytesPerSecond $DevSummary.disk.writeAverageBytesPerSecond) -PackagedValue (Format-PerfRate -BytesPerSecond $PackagedSummary.disk.writeAverageBytesPerSecond)),
        (New-PerfComparisonRow -Label 'Disk write total' -DevValue (Format-PerfBytes -Bytes $DevSummary.disk.writeTotalBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.disk.writeTotalBytes)),
        (New-PerfComparisonRow -Label 'System net rx avg' -DevValue (Format-PerfRate -BytesPerSecond $DevSummary.network.systemReceiveAverageBytesPerSecond) -PackagedValue (Format-PerfRate -BytesPerSecond $PackagedSummary.network.systemReceiveAverageBytesPerSecond)),
        (New-PerfComparisonRow -Label 'System net rx total' -DevValue (Format-PerfBytes -Bytes $DevSummary.network.systemReceiveTotalBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.network.systemReceiveTotalBytes)),
        (New-PerfComparisonRow -Label 'System net tx avg' -DevValue (Format-PerfRate -BytesPerSecond $DevSummary.network.systemSendAverageBytesPerSecond) -PackagedValue (Format-PerfRate -BytesPerSecond $PackagedSummary.network.systemSendAverageBytesPerSecond)),
        (New-PerfComparisonRow -Label 'System net tx total' -DevValue (Format-PerfBytes -Bytes $DevSummary.network.systemSendTotalBytes) -PackagedValue (Format-PerfBytes -Bytes $PackagedSummary.network.systemSendTotalBytes))
    )

    return [pscustomobject]@{
        Rows = $rows
        DevNetworkAccessSummary = (Format-PerfNetworkAccessSummary -NetworkSummary $DevSummary.network)
        PackagedNetworkAccessSummary = (Format-PerfNetworkAccessSummary -NetworkSummary $PackagedSummary.network)
        CpuAbsoluteDifferencePercent = $cpuAbsoluteDifference
        MemoryWorkingSetAverageAbsoluteDifferencePercent = $memoryWorkingSetAverageAbsoluteDifference
        ThresholdPercent = [Math]::Round($ThresholdPercent, 2)
        MemoryThresholdPercent = [Math]::Round($MemoryThresholdPercent, 2)
        IsCpuWithinThreshold = $isCpuWithinThreshold
        IsMemoryWithinThreshold = $isMemoryWithinThreshold
        IsWithinThreshold = ($isCpuWithinThreshold -and $isMemoryWithinThreshold)
    }
}