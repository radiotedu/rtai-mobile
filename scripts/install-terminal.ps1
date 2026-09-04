# RadioTEDU CLI (radiotedu-tui) Windows PowerShell Installer
# Usage: irm https://radiotedu.com/install.ps1 | iex

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '================================================' -ForegroundColor Red
Write-Host '  RadioTEDU CLI Installer (Windows / PowerShell)' -ForegroundColor White
Write-Host '================================================' -ForegroundColor Red
Write-Host ''

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[!] Node.js is not installed.' -ForegroundColor Yellow
    Write-Host '    Please install Node.js (v18 or newer) from https://nodejs.org/' -ForegroundColor Yellow
    Write-Host '    Or run: winget install OpenJS.NodeJS.LTS' -ForegroundColor Cyan
    exit 1
}

# 2. Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '[!] npm is not found in PATH.' -ForegroundColor Yellow
    exit 1
}

$nodeVer = (& node -v)
Write-Host "[+] Detected Node.js: $nodeVer" -ForegroundColor Green

# 3. Check audio decoder
$hasFfplay = (Get-Command ffplay -ErrorAction SilentlyContinue)
$hasMpv = (Get-Command mpv -ErrorAction SilentlyContinue)

if ($hasFfplay) {
    Write-Host '[+] Detected audio decoder: ffplay' -ForegroundColor Green
} elseif ($hasMpv) {
    Write-Host '[+] Detected audio decoder: mpv' -ForegroundColor Green
} else {
    Write-Host '[i] Note: Neither ffplay nor mpv was detected in PATH.' -ForegroundColor Yellow
    Write-Host '    To listen to live radio streams, install ffmpeg (recommended):' -ForegroundColor Gray
    Write-Host '    Run: winget install Gyan.FFmpeg' -ForegroundColor Cyan
    Write-Host '    (You can still use radiotedu for voting, chat, and account status)' -ForegroundColor Gray
}

# 4. Install radiotedu-tui globally via npm
Write-Host ''
Write-Host '[*] Installing radiotedu-tui globally via npm...' -ForegroundColor Cyan

$tarballUrl = 'https://radiotedu.com/tui/radiotedu-tui.tgz'
$installSuccess = $false

try {
    & npm install -g $tarballUrl
    if ($LASTEXITCODE -eq 0) {
        $installSuccess = $true
    }
} catch {
    $installSuccess = $false
}

if (-not $installSuccess) {
    Write-Host '[!] Direct tarball install failed, falling back to official GitHub repository...' -ForegroundColor Yellow
    & npm install -g 'git+https://github.com/radiotedu/rtai-mobile.git#main:terminal'
}

# 5. Verification
Write-Host ''
if (Get-Command radiotedu -ErrorAction SilentlyContinue) {
    Write-Host '================================================' -ForegroundColor Green
    Write-Host '  RadioTEDU CLI successfully installed!         ' -ForegroundColor Green
    Write-Host '================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'To launch the studio console:' -ForegroundColor White
    Write-Host '  radiotedu' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'To sign in with your 8-digit device code:' -ForegroundColor White
    Write-Host '  radiotedu login' -ForegroundColor Cyan
    Write-Host '  (Visit https://radiotedu.com/erp/device to get your code)' -ForegroundColor Gray
    Write-Host ''
} else {
    Write-Host '[!] radiotedu installed, but the npm global bin directory might not be in your current PATH.' -ForegroundColor Yellow
    Write-Host '    Please restart your terminal or add npm global path to PATH.' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'To find your npm global bin path, run: npm prefix -g' -ForegroundColor Cyan
}
