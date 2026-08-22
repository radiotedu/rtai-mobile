$ErrorActionPreference = 'Stop'
$IsAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $IsAdministrator) {
    $Process = Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
    ) -Wait -PassThru
    exit $Process.ExitCode
}

$RuntimeRoot = Join-Path $env:ProgramData 'RadioTEDU\ServicesCompanion'
$ResultPath = Join-Path $RuntimeRoot 'autonomy-verification.json'
$ServiceName = 'RadioTEDU.AIStreams'
$WatchdogTask = 'RadioTEDU-Autonomous-Watchdog'
$Result = [ordered]@{
    tested_at = [DateTime]::UtcNow.ToString('o')
    child_relaunch = $null
    watchdog_service_recovery = $null
    companion_child_relaunch = $null
    companion_watchdog_recovery = $null
    voting_ui_self_restart = $null
    stream_runtime = $null
    boot_configuration = $null
    passed = $false
    error = ''
}

function Wait-Until([scriptblock]$Condition,[int]$Seconds,[string]$Failure) {
    $Deadline = (Get-Date).AddSeconds($Seconds)
    do {
        $Value = & $Condition
        if ($Value) { return $Value }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $Deadline)
    throw $Failure
}

function Get-AiHealth([int]$Port) {
    $Raw = & curl.exe --silent --max-time 5 "http://127.0.0.1:$Port/health"
    if ($LASTEXITCODE -ne 0 -or -not $Raw) { return $null }
    try { return $Raw | ConvertFrom-Json } catch { return $null }
}

function Test-LocalEndpoint([string]$Uri) {
    & curl.exe --silent --output NUL --max-time 5 $Uri
    return $LASTEXITCODE -eq 0
}

function Stop-ActiveWatchdog {
    Stop-ScheduledTask -TaskName $WatchdogTask -ErrorAction SilentlyContinue
    Wait-Until {
        $Task = Get-ScheduledTask -TaskName $WatchdogTask
        if ($Task.State -ne 'Running') { $Task }
    } 30 'Could not obtain an idle watchdog task for the recovery probe.' | Out-Null
}

try {
    $InitialService = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
    if ($InitialService.State -ne 'Running') { Start-Service -Name $ServiceName }
    $InitialService = Wait-Until { $S=Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"; if($S.State -eq 'Running'){$S} } 60 'AI service did not reach Running.'
    $InitialHostPid = [int]$InitialService.ProcessId
    $InitialChild = Wait-Until {
        Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq $InitialHostPid | Select-Object -First 1
    } 30 'AI supervisor child was not found.'
    $InitialChildPid = [int]$InitialChild.ProcessId

    Stop-Process -Id $InitialChildPid -Force
    $ReplacementChild = Wait-Until {
        Get-CimInstance Win32_Process | Where-Object {
            $_.ParentProcessId -eq $InitialHostPid -and $_.ProcessId -ne $InitialChildPid
        } | Select-Object -First 1
    } 60 'Service host did not relaunch the terminated AI supervisor.'
    $Result.child_relaunch = [ordered]@{
        passed = $true
        service_host_pid = $InitialHostPid
        terminated_child_pid = $InitialChildPid
        replacement_child_pid = [int]$ReplacementChild.ProcessId
        host_remained_running = (Get-Service -Name $ServiceName).Status -eq 'Running'
    }

    # A periodic watchdog instance may already be checking endpoints. Because the
    # task deliberately ignores overlapping instances, stop that checker first so
    # this destructive recovery probe always starts a fresh SYSTEM watchdog run.
    Stop-ActiveWatchdog

    Stop-Service -Name $ServiceName -Force
    (Get-Service -Name $ServiceName).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60))
    $StoppedAt = [DateTime]::UtcNow
    Start-ScheduledTask -TaskName $WatchdogTask
    $RecoveredService = Wait-Until {
        $S=Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
        if($S.State -eq 'Running' -and $S.ProcessId -ne 0){$S}
    } 120 'SYSTEM watchdog did not restore the stopped AI service.'
    $Result.watchdog_service_recovery = [ordered]@{
        passed = $true
        stopped_at = $StoppedAt.ToString('o')
        recovered_at = [DateTime]::UtcNow.ToString('o')
        recovered_host_pid = [int]$RecoveredService.ProcessId
        automatic = $true
    }

    $RuntimeProof = Wait-Until {
        $En = Get-AiHealth 8765
        $Fr = Get-AiHealth 8766
        if (-not $En -or -not $Fr) { return $null }
        $EnLegacy = $En.state.outputs.legacy
        $FrLegacy = $Fr.state.outputs.legacy
        $EnSent = [datetime]::MinValue
        $FrSent = [datetime]::MinValue
        if (-not [datetime]::TryParse([string]$EnLegacy.audio_sent_at,[ref]$EnSent) -or
            -not [datetime]::TryParse([string]$FrLegacy.audio_sent_at,[ref]$FrSent)) {
            return $null
        }
        $EnSent = $EnSent.ToUniversalTime()
        $FrSent = $FrSent.ToUniversalTime()
        if ($EnSent -gt $StoppedAt -and $FrSent -gt $StoppedAt -and
            [int]$EnLegacy.host_queue.queue_depth -ge 1 -and [int]$FrLegacy.host_queue.queue_depth -ge 1) {
            return [ordered]@{
                en_audio_sent_at = $EnSent.ToString('o')
                fr_audio_sent_at = $FrSent.ToString('o')
                en_queue_depth = [int]$EnLegacy.host_queue.queue_depth
                fr_queue_depth = [int]$FrLegacy.host_queue.queue_depth
                en_origin_ready = [bool]$EnLegacy.origin_listener_ready
                fr_origin_ready = [bool]$FrLegacy.origin_listener_ready
            }
        }
        return $null
    } 180 'Recovered AI service did not produce fresh EN and FR audio with host queues.'
    $Result.stream_runtime = $RuntimeProof

    $CompanionSpecs = @(
        @{ Name='RadioTEDU.SharedAI'; Uri='http://127.0.0.1:11434/api/tags' },
        @{ Name='RadioTEDUVotingRadio'; Uri='http://127.0.0.1:4317/api/health' },
        @{ Name='RadioTEDU.JukeLocalMediaAgent'; Uri='http://127.0.0.1:3210/v1/health' }
    )
    $ChildEvidence = [ordered]@{}
    foreach ($Spec in $CompanionSpecs) {
        $Service = Get-CimInstance Win32_Service -Filter "Name='$($Spec.Name)'"
        if ($Service.State -ne 'Running') { Start-Service -Name $Spec.Name }
        $Service = Wait-Until {
            $Candidate=Get-CimInstance Win32_Service -Filter "Name='$($Spec.Name)'"
            if($Candidate.State -eq 'Running' -and $Candidate.ProcessId -ne 0){$Candidate}
        } 60 "$($Spec.Name) did not reach Running."
        $HostPid = [int]$Service.ProcessId
        $Child = Wait-Until {
            Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq $HostPid | Select-Object -First 1
        } 30 "$($Spec.Name) supervisor child was not found."
        $ChildPid = [int]$Child.ProcessId
        Stop-Process -Id $ChildPid -Force
        $Replacement = Wait-Until {
            Get-CimInstance Win32_Process | Where-Object {
                $_.ParentProcessId -eq $HostPid -and $_.ProcessId -ne $ChildPid
            } | Select-Object -First 1
        } 60 "$($Spec.Name) did not relaunch its terminated child."
        Wait-Until { if(Test-LocalEndpoint $Spec.Uri){$true} } 120 "$($Spec.Name) endpoint did not recover after child relaunch." | Out-Null
        $ChildEvidence[$Spec.Name] = [ordered]@{
            passed = $true
            service_host_pid = $HostPid
            terminated_child_pid = $ChildPid
            replacement_child_pid = [int]$Replacement.ProcessId
            endpoint = $Spec.Uri
        }
    }
    $Result.companion_child_relaunch = $ChildEvidence

    $RecoveryEvidence = [ordered]@{}
    foreach ($Spec in $CompanionSpecs) {
        Stop-ActiveWatchdog
        Stop-Service -Name $Spec.Name -Force
        (Get-Service -Name $Spec.Name).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60))
        $StoppedAt = [DateTime]::UtcNow
        Start-ScheduledTask -TaskName $WatchdogTask
        $Recovered = Wait-Until {
            $Candidate=Get-CimInstance Win32_Service -Filter "Name='$($Spec.Name)'"
            if($Candidate.State -eq 'Running' -and $Candidate.ProcessId -ne 0){$Candidate}
        } 120 "SYSTEM watchdog did not restore $($Spec.Name)."
        Wait-Until { if(Test-LocalEndpoint $Spec.Uri){$true} } 120 "$($Spec.Name) endpoint did not recover after service restoration." | Out-Null
        $RecoveryEvidence[$Spec.Name] = [ordered]@{
            passed = $true
            stopped_at = $StoppedAt.ToString('o')
            recovered_at = [DateTime]::UtcNow.ToString('o')
            recovered_host_pid = [int]$Recovered.ProcessId
            endpoint = $Spec.Uri
        }
    }
    $Result.companion_watchdog_recovery = $RecoveryEvidence

    $VotingBefore = Get-CimInstance Win32_Service -Filter "Name='RadioTEDUVotingRadio'"
    $VotingBeforePid = [int]$VotingBefore.ProcessId
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4317/api/operator/services/voting/restart' -ContentType 'application/json' -Body '{}' -TimeoutSec 15 | Out-Null
    $VotingAfter = Wait-Until {
        $Candidate=Get-CimInstance Win32_Service -Filter "Name='RadioTEDUVotingRadio'"
        if($Candidate.State -eq 'Running' -and $Candidate.ProcessId -ne 0 -and $Candidate.ProcessId -ne $VotingBeforePid -and (Test-LocalEndpoint 'http://127.0.0.1:4317/api/health')){$Candidate}
    } 120 'Voting service did not complete its UI-scheduled self-restart.'
    $Result.voting_ui_self_restart = [ordered]@{
        passed = $true
        previous_host_pid = $VotingBeforePid
        replacement_host_pid = [int]$VotingAfter.ProcessId
        endpoint = 'http://127.0.0.1:4317/api/health'
    }

    $StartupTask = Get-ScheduledTask -TaskName 'RadioTEDU-Autonomous-Start'
    $Watchdog = Get-ScheduledTask -TaskName $WatchdogTask
    $BootTriggers = @($StartupTask.Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger' })
    $BootServices = [ordered]@{}
    foreach ($Name in @('RadioTEDU.SharedAI','RadioTEDUVotingRadio','RadioTEDU.JukeLocalMediaAgent','RadioTEDU.AIStreams')) {
        $Service = Get-CimInstance Win32_Service -Filter "Name='$Name'"
        $Delayed = [int](Get-ItemPropertyValue -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\$Name" -Name DelayedAutoStart -ErrorAction SilentlyContinue)
        $FailureFlag = [int](Get-ItemPropertyValue -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\$Name" -Name FailureActionsOnNonCrashFailures -ErrorAction SilentlyContinue)
        $FailureActions = Get-ItemPropertyValue -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\$Name" -Name FailureActions -ErrorAction SilentlyContinue
        $BootServices[$Name] = [ordered]@{
            start_mode = [string]$Service.StartMode
            service_account = [string]$Service.StartName
            delayed_auto_start = $Delayed
            recovery_on_non_crash = $FailureFlag
            recovery_action_bytes = @($FailureActions).Count
        }
    }
    if ($BootTriggers.Count -lt 1 -or $StartupTask.Principal.UserId -ne 'SYSTEM' -or $Watchdog.Principal.UserId -ne 'SYSTEM' -or
        @($BootServices.Values | Where-Object {
            $_.start_mode -ne 'Auto' -or $_.service_account -ne 'LocalSystem' -or $_.delayed_auto_start -ne 0 -or
            $_.recovery_on_non_crash -ne 1 -or $_.recovery_action_bytes -lt 1
        }).Count) {
        throw 'Boot trigger, SYSTEM identity, immediate Automatic startup, or SCM recovery configuration is missing.'
    }
    $Result.boot_configuration = [ordered]@{
        passed = $true
        startup_task_principal = [string]$StartupTask.Principal.UserId
        watchdog_task_principal = [string]$Watchdog.Principal.UserId
        boot_trigger_count = $BootTriggers.Count
        start_when_available = [bool]$StartupTask.Settings.StartWhenAvailable
        wake_to_run = [bool]$StartupTask.Settings.WakeToRun
        services = $BootServices
    }
    $Result.passed = $true
} catch {
    $Result.error = $_.Exception.GetBaseException().Message
    throw
} finally {
    $Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($Service -and $Service.Status -ne 'Running') {
        try { Start-Service -Name $ServiceName -ErrorAction SilentlyContinue } catch {}
    }
    [IO.File]::WriteAllText(
        $ResultPath,
        ($Result | ConvertTo-Json -Depth 8),
        [Text.UTF8Encoding]::new($false)
    )
}
