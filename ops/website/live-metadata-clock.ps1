[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://radiotedu.com/wp-json/radiotedu/v1',
    [ValidateRange(2, 30)]
    [int]$IntervalSeconds = 3,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$stationIds = @(
    'radiotedu-main',
    'radiotedu-classic',
    'radiotedu-jazz',
    'radiotedu-rock',
    'radiotedu-spark'
)
$stateDirectory = 'C:\RadioTEDU\state'
$statePath = Join-Path $stateDirectory 'live-metadata-clock.json'

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(8)
$client.DefaultRequestHeaders.Accept.ParseAdd('application/json')
$client.DefaultRequestHeaders.UserAgent.ParseAdd('RadioTEDU-Live-Metadata-Clock/1.0')

try {
    do {
        $startedAt = [DateTimeOffset]::UtcNow
        $succeeded = 0
        $failed = 0
        $requests = @()

        foreach ($stationId in $stationIds) {
            $uri = '{0}/stations/{1}/live?clock=1' -f $BaseUrl.TrimEnd('/'), [Uri]::EscapeDataString($stationId)
            $requests += [pscustomobject]@{
                StationId = $stationId
                Task = $client.GetAsync($uri)
            }
        }

        foreach ($request in $requests) {
            try {
                if (-not $request.Task.Wait([TimeSpan]::FromSeconds(10))) {
                    $failed += 1
                    continue
                }
                $response = $request.Task.GetAwaiter().GetResult()
                try {
                    $payload = $null
                    if ($response.IsSuccessStatusCode) {
                        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                        $payload = $body | ConvertFrom-Json
                    }
                    if ($response.IsSuccessStatusCode -and $payload.track -and $payload.track_started_at) {
                        $succeeded += 1
                    } else {
                        $failed += 1
                    }
                } finally {
                    $response.Dispose()
                }
            } catch {
                $failed += 1
            }
        }

        $state = [ordered]@{
            checked_at = [DateTimeOffset]::UtcNow.ToString('o')
            cycle_started_at = $startedAt.ToString('o')
            succeeded = $succeeded
            failed = $failed
            station_count = $stationIds.Count
            interval_seconds = $IntervalSeconds
        }
        [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
        if ($Once) {
            $state | ConvertTo-Json -Compress
            break
        }

        Start-Sleep -Seconds $IntervalSeconds
    } while ($true)
} finally {
    $client.Dispose()
}
