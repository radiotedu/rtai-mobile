# RadioTEDU Terminal Windows Installer
# Usage: irm https://raw.githubusercontent.com/radiotedu/rtai-mobile/main/terminal/install.ps1 | iex

Write-Host "=============================================" -ForegroundColor Red
Write-Host "          RADIOTEDU TERMINAL CLI             " -ForegroundColor White
Write-Host "   Spotify-inspired Interactive Player       " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Red
Write-Host ""

# 1. Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Error: Node.js is required but not found." -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org or run: winget install OpenJS.NodeJS" -ForegroundColor Yellow
    exit 1
}

# 2. Check Audio Engine
$player = Get-Command mpv -ErrorAction SilentlyContinue
if (-not $player) {
    $player = Get-Command ffplay -ErrorAction SilentlyContinue
}
if ($player) {
    Write-Host "Found audio player: $($player.Name)" -ForegroundColor Green
} else {
    Write-Host "Warning: Neither mpv nor ffplay found." -ForegroundColor Yellow
    Write-Host "For audio playback, install mpv via winget: winget install shinchiro.mpv" -ForegroundColor Gray
}

# 3. Install via npm
Write-Host "Installing radiotedu package globally..." -ForegroundColor Cyan
npm install -g git+https://github.com/radiotedu/rtai-mobile.git#main:terminal

# 4. Verify
$rt = Get-Command radiotedu -ErrorAction SilentlyContinue
if ($rt) {
    Write-Host ""
    Write-Host "RadioTEDU Terminal successfully installed!" -ForegroundColor Green
    Write-Host "Run: radiotedu" -ForegroundColor White
} else {
    Write-Host "Please restart your terminal to reload PATH, then run: radiotedu" -ForegroundColor Cyan
}
