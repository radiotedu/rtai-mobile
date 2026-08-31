[CmdletBinding()]
param(
    [string]$TaskName = 'RadioTEDU Live Metadata Clock',
    [string]$InstallDirectory = 'C:\RadioTEDU\service'
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'live-metadata-clock.ps1'
$destination = Join-Path $InstallDirectory 'live-metadata-clock.ps1'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Monitor source not found: $source"
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Force

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $destination
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -RestartCount 20 `
    -RestartInterval ([TimeSpan]::FromMinutes(1))

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

[pscustomobject]@{
    TaskName = $TaskName
    Script = $destination
    State = (Get-ScheduledTask -TaskName $TaskName).State.ToString()
}
