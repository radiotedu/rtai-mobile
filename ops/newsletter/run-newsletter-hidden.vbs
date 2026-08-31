Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""C:\RadioTEDU\newsletter\run-newsletter.ps1""", 0, True
