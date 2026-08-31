$ErrorActionPreference = 'Stop'

$taskName = 'RadioTEDU Monthly Podcast Newsletter'
$runtimeRoot = 'C:\RadioTEDU\newsletter'
$desktop = [Environment]::GetFolderPath('Desktop')
$newsletterWord = 'B' + [char]0x00FC + 'lteni'
$startWord = 'Ba' + [char]0x015F + 'lat'

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '//B //NoLogo "C:\RadioTEDU\newsletter\run-newsletter-hidden.vbs"'
$firstRun = (Get-Date).Date.AddDays(1).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $firstRun -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Description 'Syncs verified ERP identities read-only and sends only the RadioTEDU monthly podcast newsletter.' -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
$stopShortcut = $shell.CreateShortcut((Join-Path $desktop ("RadioTEDU $newsletterWord Durdur.lnk")))
$stopShortcut.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$stopShortcut.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\RadioTEDU\newsletter\pause-newsletter.ps1"'
$stopShortcut.WorkingDirectory = $runtimeRoot
$stopShortcut.Description = 'Yalnizca RadioTEDU aylik podcast bultenini durdurur.'
$stopShortcut.WindowStyle = 7
$stopShortcut.Save()

$startShortcutTemporary = Join-Path $desktop 'RadioTEDU Newsletter Start.tmp.lnk'
$startShortcutFinal = Join-Path $desktop ("RadioTEDU $newsletterWord $startWord.lnk")
$startShortcut = $shell.CreateShortcut($startShortcutTemporary)
$startShortcut.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$startShortcut.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\RadioTEDU\newsletter\resume-newsletter.ps1"'
$startShortcut.WorkingDirectory = $runtimeRoot
$startShortcut.Description = 'RadioTEDU aylik podcast bultenini yeniden baslatir.'
$startShortcut.WindowStyle = 7
$startShortcut.Save()
if ([System.IO.File]::Exists($startShortcutFinal)) {
    [System.IO.File]::Delete($startShortcutFinal)
}
[System.IO.File]::Move($startShortcutTemporary, $startShortcutFinal)
