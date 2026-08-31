$ErrorActionPreference = 'Stop'
$pauseFile = 'C:\RadioTEDU\state\newsletter-paused.flag'
$taskName = 'RadioTEDU Monthly Podcast Newsletter'

New-Item -ItemType File -Path $pauseFile -Force | Out-Null
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Disable-ScheduledTask -TaskName $taskName | Out-Null
}
