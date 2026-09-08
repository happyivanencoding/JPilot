param([int]$Port = 3003)
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ProxyScript = Join-Path $PSScriptRoot 'lan-demo-proxy.mjs'
$StateDirectory = Join-Path $Root '.career-ops-web'
$StateFile = Join-Path $StateDirectory 'lan-demo.json'
$TaskName = 'JobPilot LAN Demo'
$RuleName = "JobPilot LAN Demo $Port"
$Node = (Get-Command node -ErrorAction Stop).Source
$User = [Security.Principal.WindowsIdentity]::GetCurrent().Name

$Principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Starting the LAN demo requires an elevated PowerShell because it creates a narrow Windows Firewall rule.'
}

$WebStatus = (& curl.exe --noproxy '*' -sS -o NUL -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/).Trim()
if ($LASTEXITCODE -ne 0 -or $WebStatus -notmatch '^[23]\d\d$') {
    throw 'JobPilot Web is not reachable on 127.0.0.1:3000. Start it with web\scripts\start-mobile.ps1 first.'
}

$Lan = Get-NetIPConfiguration | Where-Object {
    $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address -and $_.IPv4DefaultGateway
} | Sort-Object @{ Expression = { if ($_.InterfaceAlias -eq 'Wi-Fi') { 0 } else { 1 } } } | Select-Object -First 1
if (-not $Lan) { throw 'No active IPv4 LAN interface with a default gateway was found.' }
$Address = [string]$Lan.IPv4Address.IPAddress

New-Item -ItemType Directory -Force $StateDirectory | Out-Null

# Clean up the first LAN-demo implementation if it left a Windows TCP port-proxy.
if (Test-Path $StateFile) {
    try {
        $Previous = Get-Content $StateFile -Raw | ConvertFrom-Json
        if ($Previous.address -and $Previous.port) {
            & netsh interface portproxy delete v4tov4 listenaddress=$($Previous.address) listenport=$($Previous.port) | Out-Null
        }
    } catch {
        Write-Warning "Could not clean previous LAN demo state: $($_.Exception.Message)"
    }
}

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    if (-not ([string]$ExistingTask.Actions.Arguments).Contains($ProxyScript)) {
        throw "Scheduled task '$TaskName' belongs to another command or installation; refusing to replace it."
    }
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Start-Sleep -Milliseconds 300
}

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

$Occupied = netstat.exe -ano -p tcp | Select-String -Pattern "\s(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]|\[::1\]|\d{1,3}(?:\.\d{1,3}){3}):$Port\s+.*LISTENING\s+(\d+)\s*$" | Select-Object -First 1
if ($Occupied) {
    $Pid = if ($Occupied.Matches.Count) { $Occupied.Matches[0].Groups[1].Value } else { 'unknown' }
    throw "Port $Port is already in use by PID $Pid. Choose another port with -Port."
}

New-NetFirewallRule `
    -DisplayName $RuleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalAddress $Address `
    -LocalPort $Port `
    -RemoteAddress LocalSubnet `
    -Profile Any `
    -Description 'Temporary JobPilot browser demo endpoint for devices on the same local subnet.' | Out-Null

$Arguments = "`"$ProxyScript`" --host $Address --port $Port"
$Action = New-ScheduledTaskAction -Execute $Node -Argument $Arguments -WorkingDirectory (Join-Path $Root 'web')
$TaskPrincipal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $Action -Principal $TaskPrincipal -Settings $Settings -Description 'Temporary trusted-LAN JobPilot demo proxy. No automatic trigger.' -Force | Out-Null

$State = [ordered]@{
    address = $Address
    port = $Port
    upstream = 'http://127.0.0.1:3000'
    interface = [string]$Lan.InterfaceAlias
    taskName = $TaskName
    createdAt = (Get-Date).ToString('o')
}
$State | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Milliseconds 700

$Url = "http://${Address}:$Port"
$Status = (& curl.exe --noproxy '*' -sS -o NUL -w '%{http_code}' --max-time 8 "$Url/").Trim()
if ($LASTEXITCODE -ne 0 -or $Status -notmatch '^[23]\d\d$') {
    throw "LAN demo task started but the HTTP check failed for $Url (status: $Status)."
}

Write-Output "JobPilot LAN demo is ready: $Url"
Write-Output 'Devices must be on the same local network. This endpoint intentionally skips Cloudflare Access.'
Write-Output 'Stop it with: .\web\scripts\stop-lan-demo.ps1'
