param(
  [string]$ArchiveName = "RadioTEDU-Study-webserver-handoff-2026-08-04.rar"
)

$ErrorActionPreference = "Stop"
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot ".."))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "artifacts\study-game\release"))
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "RadioTEDU-Study"))
$archivePath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot $ArchiveName))

if (-not $sourceRoot.EndsWith("\study-game", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unexpected source path: $sourceRoot"
}
if (-not $stagingRoot.StartsWith($releaseRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging path: $stagingRoot"
}

$rarPath = @(
  "C:\Program Files\WinRAR\Rar.exe",
  "C:\Program Files (x86)\WinRAR\Rar.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $rarPath) { throw "WinRAR Rar.exe was not found." }
$nodePath = Join-Path $env:ProgramFiles "nodejs\node.exe"
if (-not (Test-Path -LiteralPath $nodePath)) { throw "Node.js was not found at $nodePath" }

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

$excluded = @(
  (Join-Path $sourceRoot "node_modules"),
  (Join-Path $sourceRoot "playwright-report"),
  (Join-Path $sourceRoot "test-results")
)
$copyResult = & robocopy $sourceRoot $stagingRoot /E /R:1 /W:1 /XD $excluded /XF ".env" ".env.*" "*.pem" "*.key" "*.p12" "*.pfx" "*.jks" "*.keystore" /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -gt 7) { throw "Robocopy failed with exit code $LASTEXITCODE" }

$stressReport = Join-Path $repoRoot "artifacts\study-game\stress\stress-60-players-report.json"
if (Test-Path -LiteralPath $stressReport) {
  $evidenceRoot = Join-Path $stagingRoot "release-evidence"
  New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
  Copy-Item -LiteralPath $stressReport -Destination (Join-Path $evidenceRoot "stress-60-players-report.json")
}

& $nodePath (Join-Path $stagingRoot "scripts\verify-release-bundle.mjs") $stagingRoot
if ($LASTEXITCODE -ne 0) { throw "Secret-safe release verification failed." }

$manifestEntries = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
  $relativePath = $_.FullName.Substring($stagingRoot.Length).TrimStart("\")
  [ordered]@{
    file = $relativePath.Replace("\", "/")
    bytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
$manifest = [ordered]@{
  format = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  package = "RadioTEDU Study"
  publicPath = "https://radiotedu.com/study/"
  secretsIncluded = $false
  files = $manifestEntries
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagingRoot "RELEASE_MANIFEST.json") -Encoding UTF8

if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
Push-Location $releaseRoot
try {
  & $rarPath a -r -m5 -idq $archivePath "RadioTEDU-Study\*"
  if ($LASTEXITCODE -ne 0) { throw "RAR creation failed with exit code $LASTEXITCODE" }
  & $rarPath t -idq $archivePath
  if ($LASTEXITCODE -ne 0) { throw "RAR integrity test failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$archiveSize = (Get-Item -LiteralPath $archivePath).Length
[ordered]@{
  status = "passed"
  archive = $archivePath
  bytes = $archiveSize
  sha256 = $archiveHash
  files = $manifestEntries.Count + 1
  secretsIncluded = $false
} | ConvertTo-Json
