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
$hasVlc = (Get-Command vlc -ErrorAction SilentlyContinue)
$targetDir = "$env:USERPROFILE\.radiotedu\bin"
$portableFfplay = "$targetDir\ffplay.exe"

if ($hasFfplay) {
    Write-Host '[+] Detected audio decoder: ffplay' -ForegroundColor Green
} elseif ($hasMpv) {
    Write-Host '[+] Detected audio decoder: mpv' -ForegroundColor Green
} elseif ($hasVlc) {
    Write-Host '[+] Detected audio decoder: VLC' -ForegroundColor Green
} elseif ((Test-Path $portableFfplay) -and ((Get-Item $portableFfplay).Length -gt 10000000)) {
    Write-Host "[+] Detected portable audio decoder: $portableFfplay" -ForegroundColor Green
    $env:PATH = "$env:PATH;$targetDir"
} else {
    Write-Host '[*] Downloading portable audio engine (ffplay) from RadioTEDU...' -ForegroundColor Cyan
    try {
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri 'https://radiotedu.com/tui/tools/ffplay.exe' -OutFile $portableFfplay
        if ((Test-Path $portableFfplay) -and ((Get-Item $portableFfplay).Length -gt 10000000)) {
            Write-Host '[+] Successfully installed portable audio engine (ffplay)!' -ForegroundColor Green
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            if ($userPath -notlike "*$targetDir*") {
                [Environment]::SetEnvironmentVariable('Path', "$userPath;$targetDir", 'User')
                $env:PATH = "$env:PATH;$targetDir"
            }
        }
    } catch {
        Write-Host '[!] Note: Audio engine will be auto-downloaded on first start.' -ForegroundColor Yellow
    }
}


# 4. Install radiotedu-tui globally via npm
Write-Host ''
Write-Host '[*] Installing radiotedu-tui globally via npm...' -ForegroundColor Cyan

$cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$tarballUrl = "https://radiotedu.com/tui/radiotedu-tui.tgz?v=$cacheBuster"
$installSuccess = $false

try {
    & npm install -g --prefer-online "$tarballUrl"
    if ($LASTEXITCODE -eq 0) {
        $installSuccess = $true
    }
} catch {
    $installSuccess = $false
}

if (-not $installSuccess) {
    Write-Host '[!] Direct tarball install failed, falling back to official GitHub repository...' -ForegroundColor Yellow
    & npm install -g 'git+https://github.com/radiotedu/radiotedu-tui.git'
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
