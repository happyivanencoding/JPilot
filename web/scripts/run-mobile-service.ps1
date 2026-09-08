param([ValidateSet('web','gateway')][string]$Service, [switch]$UsbDebug)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location (Join-Path $Root 'web')
$env:CAREER_OPS_ROOT = $Root
$env:JOBPILOT_USB_LOGIN = if ($UsbDebug) { '1' } else { '0' }
$LogDirectory = Join-Path $Root '.career-ops-web\mobile-logs'
New-Item -ItemType Directory -Force $LogDirectory | Out-Null
$Log = Join-Path $LogDirectory ($Service + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$Node = (Get-Command node -ErrorAction Stop).Source
if ($Service -eq 'web') {
    $Arguments = @('"' + (Join-Path $Root 'web\node_modules\next\dist\bin\next') + '"') + @('start', '--hostname', '127.0.0.1', '--port', '3000')
} else {
    $Arguments = @('"' + (Join-Path $PSScriptRoot 'mobile-gateway.mjs') + '"')
}
# PowerShell 5.1 can promote a native stderr warning to a terminating error.
# Direct file redirection keeps Node diagnostics from terminating the service.
$Process = Start-Process -FilePath $Node -ArgumentList $Arguments -WorkingDirectory (Join-Path $Root 'web') -WindowStyle Hidden -RedirectStandardOutput ($Log + '.out') -RedirectStandardError ($Log + '.err') -PassThru
if ($Service -eq 'web') {
    # Prepare one JobPilot ACP session as part of service startup. This pays the
    # variable Codex session/new latency before a phone user taps an AI action.
    try {
        $Ready = $false
        for ($i = 0; $i -lt 120; $i++) {
            if ($Process.HasExited) { throw "JobPilot web exited before becoming ready." }
            $Listening = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($Listening) { $Ready = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $Ready) { throw 'JobPilot web did not listen on port 3000 within 60 seconds.' }
        $Warm = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3000/api/internal/prewarm' -TimeoutSec 370
        Add-Content -Path ($Log + '.out') -Value ("JobPilot ACP prewarm ready={0} wallMs={1}" -f $Warm.ready,$Warm.wallMs)
    } catch {
        Add-Content -Path ($Log + '.err') -Value ("JobPilot ACP prewarm failed: " + $_.Exception.Message)
    }
}
if ($Service -eq 'gateway') {
    # Keep the public edge available if Node exits cleanly without giving the
    # scheduled task a failure code (which otherwise bypasses Task Scheduler's
    # failure-restart policy). Stopping the scheduled task still terminates
    # this loop and its child together.
    while ($true) {
        $Process.WaitForExit()
        Add-Content -Path ($Log + '.err') -Value ("JobPilot gateway exited with code {0}; restarting in 5 seconds." -f $Process.ExitCode)
        Start-Sleep -Seconds 5
        $Process = Start-Process -FilePath $Node -ArgumentList $Arguments -WorkingDirectory (Join-Path $Root 'web') -WindowStyle Hidden -RedirectStandardOutput ($Log + '.out') -RedirectStandardError ($Log + '.err') -PassThru
    }
}
$Process.WaitForExit()
exit $Process.ExitCode
