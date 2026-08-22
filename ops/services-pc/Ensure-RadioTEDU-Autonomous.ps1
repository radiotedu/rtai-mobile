param(
    [int]$EndpointWaitSeconds = 90
)

$ErrorActionPreference = 'Continue'
$RuntimeRoot = Join-Path $env:ProgramData 'RadioTEDU\ServicesCompanion'
$LogRoot = Join-Path $RuntimeRoot 'logs'
$LogPath = Join-Path $LogRoot 'autonomous-recovery.log'
$LockPath = Join-Path $RuntimeRoot 'autonomous-recovery.lock'
$Services = @(
    'RadioTEDU.SharedAI',
    'RadioTEDUVotingRadio',
    'RadioTEDU.JukeLocalMediaAgent',
    'RadioTEDU.AIStreams'
)

function Test-ServiceEnabled([string]$Name) {
    $Configured = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
    if (-not $Configured) { return $true }
    return $Configured.StartMode -ne 'Disabled'
}

$EnabledServices = @($Services | Where-Object { Test-ServiceEnabled $_ })

New-Item -ItemType Directory -Force -Path $RuntimeRoot,$LogRoot | Out-Null

function Write-RecoveryLog([string]$Message) {
    $line = '{0} {1}' -f ([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')),$Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

$Lock = $null
try {
    $Lock = [IO.File]::Open($LockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
} catch {
    exit 0
}

try {
    if ((Test-Path -LiteralPath $LogPath) -and (Get-Item -LiteralPath $LogPath).Length -gt 5MB) {
        Move-Item -LiteralPath $LogPath -Destination "$LogPath.previous" -Force
    }

    $RelocationScript = 'C:\Users\tedu\Desktop\Services\Move-RadioTEDU-Music-To-F.ps1'
    $RelocationStatePath = 'C:\ProgramData\RadioTEDU\ServicesCompanion\music-relocation-state.json'
    $RelocationComplete = $false
    if (Test-Path -LiteralPath $RelocationStatePath) {
        try { $RelocationComplete = (Get-Content -LiteralPath $RelocationStatePath -Raw | ConvertFrom-Json).status -eq 'complete' } catch {}
    }
    $RelocationRunning = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like '*Move-RadioTEDU-Music-To-F.ps1*'
    } | Select-Object -First 1
    if (-not $RelocationComplete -and -not $RelocationRunning -and (Test-Path -LiteralPath $RelocationScript)) {
        Start-Process powershell.exe -ArgumentList @(
            '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $RelocationScript + '"')
        ) -WindowStyle Hidden
        Write-RecoveryLog 'started resumable F: music relocation'
    }

    $Failures = @()
    foreach ($Name in $EnabledServices) {
        $Service = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if (-not $Service) {
            $Failures += "$Name missing"
            continue
        }
        if ($Service.Status -ne 'Running') {
            Write-RecoveryLog "starting service=$Name previous=$($Service.Status)"
            try {
                Start-Service -Name $Name -ErrorAction Stop
                (Get-Service -Name $Name).WaitForStatus('Running',[TimeSpan]::FromSeconds(45))
            } catch {
                $Failures += "$Name failed to start"
                Write-RecoveryLog "start failed service=$Name error=$($_.Exception.GetBaseException().Message)"
            }
        }
    }

    function Get-LocalJson([string]$Uri) {
        try {
            $Request = [Net.HttpWebRequest]::Create($Uri)
            $Request.Timeout = 5000
            $Request.ReadWriteTimeout = 5000
            $Request.AllowAutoRedirect = $false
            $Response = $Request.GetResponse()
            $Reader = [IO.StreamReader]::new($Response.GetResponseStream())
            try { $Raw = $Reader.ReadToEnd() } finally { $Reader.Dispose(); $Response.Close() }
            return $Raw | ConvertFrom-Json
        } catch [Net.WebException] {
            if ($_.Exception.Response) {
                $Response = $_.Exception.Response
                $Reader = [IO.StreamReader]::new($Response.GetResponseStream())
                try { $Raw = $Reader.ReadToEnd() } finally { $Reader.Dispose(); $Response.Close() }
                try { return $Raw | ConvertFrom-Json } catch { return $null }
            }
            return $null
        } catch {
            return $null
        }
    }

    function Test-LocalEndpoint([hashtable]$Endpoint) {
        $Payload = Get-LocalJson $Endpoint.Uri
        if (-not $Payload) { return $false }
        switch ($Endpoint.Kind) {
            'shared-ai' { return $null -ne $Payload.models }
            'voting' {
                return $Payload.status -eq 'ok' -and [bool]$Payload.ready -and
                    $Payload.votingMode -eq 'genre' -and [int]$Payload.eligibleTracks -gt 0
            }
            'juke' {
                return [bool]$Payload.ok -and [bool]$Payload.library_ready -and
                    [bool]$Payload.roots_ready -and $Payload.library_mode -eq 'all_playable'
            }
            'ai' {
                $Legacy = $Payload.state.outputs.legacy
                $Sent = [datetime]::MinValue
                if (-not $Legacy -or -not [datetime]::TryParse([string]$Legacy.audio_sent_at,[ref]$Sent)) { return $false }
                return $Sent.ToUniversalTime() -gt [DateTime]::UtcNow.AddMinutes(-3) -and
                    [int]$Legacy.track_count -gt 0 -and
                    [int]$Legacy.host_queue.queue_target -eq 10 -and
                    [int]$Legacy.host_queue.queue_depth -ge 10
            }
        }
        return $false
    }

    $Endpoints = @(@(
        @{ Name='RadioTEDU.SharedAI'; Kind='shared-ai'; Uri='http://127.0.0.1:11434/api/tags' },
        @{ Name='RadioTEDUVotingRadio'; Kind='voting'; Uri='http://127.0.0.1:4317/api/health' },
        @{ Name='RadioTEDU.JukeLocalMediaAgent'; Kind='juke'; Uri='http://127.0.0.1:3210/v1/health' },
        @{ Name='RadioTEDU.AIStreams'; Kind='ai'; Uri='http://127.0.0.1:8765/health' },
        @{ Name='RadioTEDU.AIStreams'; Kind='ai'; Uri='http://127.0.0.1:8766/health' }
    ) | Where-Object { $EnabledServices -contains $_.Name })
    $Deadline = (Get-Date).AddSeconds($EndpointWaitSeconds)
    $Pending = @($Endpoints)
    do {
        $Pending = @($Pending | Where-Object { -not (Test-LocalEndpoint $_) })
        if (-not $Pending.Count) { break }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $Deadline)

    if ($Pending.Count) {
        foreach ($Name in @($Pending.Name | Select-Object -Unique)) {
            Write-RecoveryLog "semantic health failed; restarting service=$Name"
            try {
                Restart-Service -Name $Name -Force -ErrorAction Stop
                (Get-Service -Name $Name).WaitForStatus('Running',[TimeSpan]::FromSeconds(60))
            } catch {
                Write-RecoveryLog "semantic recovery restart failed service=$Name error=$($_.Exception.GetBaseException().Message)"
            }
        }
        $SecondDeadline = (Get-Date).AddSeconds($EndpointWaitSeconds)
        do {
            $Pending = @($Pending | Where-Object { -not (Test-LocalEndpoint $_) })
            if (-not $Pending.Count) { break }
            Start-Sleep -Seconds 5
        } while ((Get-Date) -lt $SecondDeadline)
    }

    foreach ($Endpoint in $Pending) {
        $Failures += "$($Endpoint.Name) endpoint unavailable"
        Write-RecoveryLog "endpoint unavailable service=$($Endpoint.Name) uri=$($Endpoint.Uri)"
    }

    if ($Failures.Count) {
        Write-RecoveryLog "recovery incomplete failures=$($Failures -join '; ')"
        exit 1
    }
    Write-RecoveryLog 'all local services and endpoints ready; upstream stream reconnect remains automatic'
    exit 0
} finally {
    if ($Lock) { $Lock.Dispose() }
}
