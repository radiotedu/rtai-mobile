param(
    [datetime]$StartAt = (Get-Date).AddMinutes(30)
)

$ErrorActionPreference = 'Stop'
$IsAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $IsAdministrator) {
    $Arguments = @(
        '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),
        '-StartAt',('"' + $StartAt.ToString('o') + '"')
    )
    $Process = Start-Process powershell.exe -Verb RunAs -ArgumentList $Arguments -Wait -PassThru
    exit $Process.ExitCode
}

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeRoot = Join-Path $env:ProgramData 'RadioTEDU\ServicesCompanion'
$InstallLog = Join-Path $RuntimeRoot 'autonomy-install.log'
trap {
    $Message = '{0} failed: {1}' -f ([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')),$_.Exception.GetBaseException().Message
    [IO.File]::WriteAllText($InstallLog,$Message,[Text.UTF8Encoding]::new($false))
    exit 1
}
$RecoveryScript = Join-Path $RuntimeRoot 'Ensure-RadioTEDU-Autonomous.ps1'
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $Here 'Ensure-RadioTEDU-Autonomous.ps1') -Destination $RecoveryScript -Force

$Services = @(
    'RadioTEDU.SharedAI',
    'RadioTEDUVotingRadio',
    'RadioTEDU.JukeLocalMediaAgent',
    'RadioTEDU.AIStreams'
)
foreach ($Name in $Services) {
    if (-not (Get-Service -Name $Name -ErrorAction SilentlyContinue)) { continue }
    & sc.exe config $Name start= auto | Out-Null
    & reg.exe add "HKLM\SYSTEM\CurrentControlSet\Services\$Name" /v DelayedAutoStart /t REG_DWORD /d 0 /f | Out-Null
    & sc.exe failure $Name reset= 86400 actions= restart/5000/restart/15000/restart/30000 | Out-Null
    & sc.exe failureflag $Name 1 | Out-Null
}

$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$RecoveryScript`""
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

$Once = New-ScheduledTaskTrigger -Once -At $StartAt
$AtStartup = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask `
    -TaskName 'RadioTEDU-Autonomous-Start' `
    -Description 'Starts and verifies RadioTEDU at the requested time and after every boot.' `
    -Action $Action `
    -Trigger @($Once,$AtStartup) `
    -Principal $Principal `
    -Settings $Settings `
    -Force | Out-Null

$Watchdog = New-ScheduledTaskTrigger -Once -At $StartAt -RepetitionInterval (New-TimeSpan -Minutes 2)
Register-ScheduledTask `
    -TaskName 'RadioTEDU-Autonomous-Watchdog' `
    -Description 'Independently restores RadioTEDU services and local endpoints without Codex.' `
    -Action $Action `
    -Trigger $Watchdog `
    -Principal $Principal `
    -Settings $Settings `
    -Force | Out-Null

$VerificationTask = 'RadioTEDU-Autonomous-Watchdog'
Stop-ScheduledTask -TaskName $VerificationTask -ErrorAction SilentlyContinue
$IdleDeadline = (Get-Date).AddSeconds(30)
do {
    Start-Sleep -Milliseconds 500
    $VerificationState = [string](Get-ScheduledTask -TaskName $VerificationTask).State
} while ($VerificationState -eq 'Running' -and (Get-Date) -lt $IdleDeadline)
if ($VerificationState -eq 'Running') { throw 'SYSTEM watchdog did not become idle for installation verification.' }
$PreviousRun = (Get-ScheduledTaskInfo -TaskName $VerificationTask).LastRunTime
Start-ScheduledTask -TaskName $VerificationTask
$VerificationDeadline = (Get-Date).AddMinutes(5)
do {
    Start-Sleep -Seconds 1
    $VerificationInfo = Get-ScheduledTaskInfo -TaskName $VerificationTask
    $VerificationState = [string](Get-ScheduledTask -TaskName $VerificationTask).State
} while (($VerificationInfo.LastRunTime -le $PreviousRun -or $VerificationState -eq 'Running' -or $VerificationInfo.LastTaskResult -eq 267009) -and (Get-Date) -lt $VerificationDeadline)
if ($VerificationInfo.LastRunTime -le $PreviousRun -or $VerificationInfo.LastTaskResult -ne 0) {
    throw "SYSTEM watchdog verification failed with result $($VerificationInfo.LastTaskResult)."
}

$TaskAudit = foreach ($TaskName in @('RadioTEDU-Autonomous-Start','RadioTEDU-Autonomous-Watchdog')) {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    $Info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
    [ordered]@{
        task_name = $TaskName
        state = [string]$Task.State
        principal = [string]$Task.Principal.UserId
        run_level = [string]$Task.Principal.RunLevel
        next_run_time = if ($Info.NextRunTime) { $Info.NextRunTime.ToString('o') } else { $null }
        last_run_time = if ($Info.LastRunTime) { $Info.LastRunTime.ToString('o') } else { $null }
        last_result = [int]$Info.LastTaskResult
        trigger_count = @($Task.Triggers).Count
        start_when_available = [bool]$Task.Settings.StartWhenAvailable
        wake_to_run = [bool]$Task.Settings.WakeToRun
    }
}
[IO.File]::WriteAllText(
    (Join-Path $RuntimeRoot 'autonomy-status.json'),
    ($TaskAudit | ConvertTo-Json -Depth 4),
    [Text.UTF8Encoding]::new($false)
)

[IO.File]::WriteAllText(
    $InstallLog,
    ('{0} installed start={1:o}' -f ([DateTime]::UtcNow),$StartAt),
    [Text.UTF8Encoding]::new($false)
)

[pscustomobject]@{
    Installed = $true
    StartAt = $StartAt.ToString('o')
    Tasks = @('RadioTEDU-Autonomous-Start','RadioTEDU-Autonomous-Watchdog')
    RecoveryScript = $RecoveryScript
} | ConvertTo-Json -Compress
