param([int]$Port = 3003)
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ProxyScript = Join-Path $PSScriptRoot 'lan-demo-proxy.mjs'
$StateFile = Join-Path $Root '.career-ops-web\lan-demo.json'
$TaskName = 'JobPilot LAN Demo'
$RuleName = "JobPilot LAN Demo $Port"
$Stopped = $false

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    if ([string]$ExistingTask.Actions.Arguments -and ([string]$ExistingTask.Actions.Arguments).Contains($ProxyScript)) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        $Stopped = $true
    } else {
        Write-Warning "Scheduled task '$TaskName' does not belong to this JobPilot checkout; leaving it untouched."
    }
}

if (Test-Path $StateFile) {
    try {
        $State = Get-Content $StateFile -Raw | ConvertFrom-Json
        # Compatibility cleanup for the earlier TCP port-proxy implementation.
        if ($State.address -and $State.port) {
            & netsh interface portproxy delete v4tov4 listenaddress=$($State.address) listenport=$($State.port) | Out-Null
        }
    } catch {
        Write-Warning "Could not read saved LAN demo state: $($_.Exception.Message)"
    }
    Remove-Item $StateFile -Force
}

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

if ($Stopped) {
    Write-Output 'JobPilot LAN demo stopped.'
} else {
    Write-Output 'No active JobPilot LAN demo task was found; saved state/firewall rule were cleaned if present.'
}
