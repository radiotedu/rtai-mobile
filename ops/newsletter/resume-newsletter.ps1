$ErrorActionPreference = 'Stop'
$pauseFile = 'C:\RadioTEDU\state\newsletter-paused.flag'
$taskName = 'RadioTEDU Monthly Podcast Newsletter'

if (Test-Path -LiteralPath $pauseFile -PathType Leaf) {
    Remove-Item -LiteralPath $pauseFile -Force
}
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Enable-ScheduledTask -TaskName $taskName | Out-Null
}
