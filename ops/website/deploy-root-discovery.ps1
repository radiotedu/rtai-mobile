[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$WebRoot = 'C:\inetpub\wwwroot',
    [string]$GeoRoot = 'C:\inetpub\radiotedu-geo-releases\20260811-v2',
    [string]$BackupRoot = (Join-Path 'C:\RadioTEDU\backups' (Get-Date -Format 'yyyyMMdd-HHmmss-root-discovery')),
    [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$source = Join-Path $RepositoryRoot 'website\root-discovery\llms.txt'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Canonical discovery file not found: $source"
}

$targets = @(
    [pscustomobject]@{ Name = 'canonical'; Path = (Join-Path $WebRoot 'llms.txt') }
    [pscustomobject]@{ Name = 'geo'; Path = (Join-Path $GeoRoot 'llms.txt') }
)
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$results = @()

foreach ($target in $targets) {
    $targetPath = $target.Path
    $exists = Test-Path -LiteralPath $targetPath -PathType Leaf

    if (-not $VerifyOnly -and $PSCmdlet.ShouldProcess($targetPath, 'Back up and deploy llms.txt')) {
        if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
            New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
        }
        if ($exists) {
            $backupName = '{0}-llms.txt' -f $target.Name
            Copy-Item -LiteralPath $targetPath -Destination (Join-Path $BackupRoot $backupName) -Force
        }
        Copy-Item -LiteralPath $source -Destination $targetPath -Force
        $exists = $true
    }

    $targetHash = if ($exists) {
        (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
    } else {
        $null
    }
    $results += [pscustomobject]@{
        Target = $target.Name
        Path = $targetPath
        Exists = $exists
        MatchesCanonical = ($targetHash -eq $sourceHash)
        Sha256 = $targetHash
    }
}

$results | ConvertTo-Json -Depth 3
if (@($results | Where-Object { -not $_.MatchesCanonical }).Count -gt 0) {
    exit 1
}
