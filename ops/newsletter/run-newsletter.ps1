$ErrorActionPreference = 'Stop'

$pauseFile = 'C:\RadioTEDU\state\newsletter-paused.flag'
$nodeExecutable = 'C:\Program Files\nodejs\node.exe'
$phpExecutable = 'C:\php\php.exe'
$runtimeRoot = 'C:\RadioTEDU\newsletter'
$exporter = Join-Path $runtimeRoot 'export-erp-subscribers.cjs'
$newsletterCli = 'C:\inetpub\wwwroot\wp-content\plugins\radiotedu-newsletter\cli.php'
$logFile = 'C:\RadioTEDU\runtime-logs\newsletter.log'

if (Test-Path -LiteralPath $pauseFile) {
    exit 0
}

try {
    $erpMembers = & $nodeExecutable $exporter
    if ($LASTEXITCODE -ne 0) {
        throw 'ERP newsletter export did not complete.'
    }

    $syncStart = New-Object System.Diagnostics.ProcessStartInfo
    $syncStart.FileName = $phpExecutable
    $syncStart.Arguments = "`"$newsletterCli`" sync-erp"
    $syncStart.UseShellExecute = $false
    $syncStart.RedirectStandardInput = $true
    $syncStart.RedirectStandardOutput = $true
    $syncStart.RedirectStandardError = $true
    $syncStart.CreateNoWindow = $true
    $syncProcess = New-Object System.Diagnostics.Process
    $syncProcess.StartInfo = $syncStart
    [void]$syncProcess.Start()
    $syncProcess.StandardInput.Write($erpMembers)
    $syncProcess.StandardInput.Close()
    $syncResult = $syncProcess.StandardOutput.ReadToEnd().Trim()
    $syncError = $syncProcess.StandardError.ReadToEnd().Trim()
    $syncProcess.WaitForExit()
    $erpMembers = $null
    if ($syncProcess.ExitCode -ne 0) {
        throw ('ERP newsletter sync did not complete. ' + $syncError)
    }

    $runResult = & $phpExecutable $newsletterCli run
    if ($LASTEXITCODE -ne 0) {
        throw 'Newsletter scheduler did not complete.'
    }

    $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    Add-Content -LiteralPath $logFile -Encoding UTF8 -Value "$stamp $syncResult $runResult"
} catch {
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $safeMessage = ($_.Exception.Message -replace '[\r\n]+', ' ').Substring(0, [Math]::Min(300, $_.Exception.Message.Length))
    Add-Content -LiteralPath $logFile -Encoding UTF8 -Value "$stamp ERROR $safeMessage"
    exit 1
}
