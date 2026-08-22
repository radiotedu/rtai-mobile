[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$failed = $false
$rows = [Collections.Generic.List[object]]::new()

function Add-Result([string]$Name, [bool]$Ready, [string]$Detail) {
    $script:rows.Add([pscustomobject]@{ Component = $Name; Ready = $Ready; Detail = $Detail })
    if (-not $Ready) { $script:failed = $true }
}

function Get-Json([string]$Uri) {
    try {
        return Invoke-RestMethod -Uri $Uri -TimeoutSec 8
    } catch {
        return $null
    }
}

function Convert-ToDateTime([object]$Value) {
    if ($Value -is [datetime]) { return [datetime]$Value }
    $parsed = [datetime]::MinValue
    if ([datetime]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
    return $null
}

$serviceChecks = @(
    @{ Name = 'Voting'; Service = 'RadioTEDUVotingRadio'; Uri = 'http://127.0.0.1:4317/api/health'; Kind = 'voting' },
    @{ Name = 'JukeLocal'; Service = 'RadioTEDU.JukeLocalMediaAgent'; Uri = 'http://127.0.0.1:3210/v1/health'; Kind = 'juke' },
    @{ Name = 'Shared AI'; Service = 'RadioTEDU.SharedAI'; Uri = 'http://127.0.0.1:11434/api/tags'; Kind = 'ollama' },
    @{ Name = 'AI English'; Service = 'RadioTEDU.AIStreams'; Uri = 'http://127.0.0.1:8765/health'; Kind = 'ai' },
    @{ Name = 'AI French'; Service = 'RadioTEDU.AIStreams'; Uri = 'http://127.0.0.1:8766/health'; Kind = 'ai' }
)

foreach ($check in $serviceChecks) {
    $service = Get-CimInstance Win32_Service -Filter "Name='$($check.Service)'" -ErrorAction SilentlyContinue
    $payload = Get-Json $check.Uri
    $healthy = $false
    $detail = "service=$($service.State); start=$($service.StartMode)"
    if ($service -and $service.State -eq 'Running' -and $service.StartMode -eq 'Auto' -and $payload) {
        switch ($check.Kind) {
            'voting' { $healthy = [bool]$payload.ready -and $payload.votingMode -eq 'genre' -and [int]$payload.eligibleTracks -gt 0 }
            'juke' { $healthy = [bool]$payload.ok -and [bool]$payload.library_ready -and [bool]$payload.roots_ready }
            'ollama' { $healthy = @($payload.models).Count -gt 0 }
            'ai' {
                $legacy = $payload.state.outputs.legacy
                $sent = if ($legacy) { Convert-ToDateTime $legacy.audio_sent_at } else { $null }
                $fresh = $sent -and $sent.ToUniversalTime() -gt [DateTime]::UtcNow.AddMinutes(-3)
                $healthy = $fresh -and [int]$legacy.track_count -gt 0 -and [int]$legacy.host_queue.queue_depth -gt 0
            }
        }
    }
    Add-Result $check.Name $healthy $detail
}

$taskNames = @(
    'RadioTEDU-Autonomous-Start',
    'RadioTEDU-Autonomous-Watchdog',
    'RadioTEDU Stream Watchdog',
    'RadioTEDU YouTube Focus Stream V4',
    'RadioTEDU YouTube Classical Stream'
)
$allTasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue)
foreach ($name in $taskNames) {
    $task = $allTasks | Where-Object TaskName -eq $name | Select-Object -First 1
    $ready = $task -and $task.State -in @('Ready', 'Running') -and $task.Principal.UserId -eq 'SYSTEM'
    $detail = if ($task) { "state=$($task.State); principal=$($task.Principal.UserId)" } else { 'missing' }
    Add-Result $name $ready $detail
}

$streamStatuses = @(
    @{ Name = 'YouTube Focus status'; Path = 'C:\stream\output\adaptive-v4\lofi\runtime\status.json' },
    @{ Name = 'YouTube Classical status'; Path = 'C:\stream\output\adaptive\classical\runtime\status.json' }
)
foreach ($item in $streamStatuses) {
    $payload = if (Test-Path -LiteralPath $item.Path) { Get-Content -LiteralPath $item.Path -Raw | ConvertFrom-Json } else { $null }
    $updated = if ($payload) { Convert-ToDateTime $payload.updated_at } else { $null }
    $fresh = $updated -and $updated.ToUniversalTime() -gt [DateTime]::UtcNow.AddMinutes(-2)
    $ready = $fresh -and [bool]$payload.running -and -not $payload.fatal_error
    $detail = if ($payload) { "tracks=$($payload.library_track_count); updated=$($payload.updated_at)" } else { 'missing status file' }
    Add-Result $item.Name $ready $detail
}

$rows | Format-Table -AutoSize -Wrap
if ($failed) { exit 1 }
exit 0
