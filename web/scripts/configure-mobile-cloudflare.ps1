param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$LocalFile = Join-Path $Root '.career-ops-web\mobile-access.json'
$Local = Get-Content $LocalFile -Raw -Encoding UTF8 | ConvertFrom-Json
$Emails = @($Local.accounts.PSObject.Properties.Name)
if ($Emails.Count -lt 1) { throw 'JobPilot needs at least one configured workspace account.' }
if ($Emails.Count -gt 1 -and [string]$Local.workspaceMode -ne 'shared') { throw 'Multiple accounts require an explicit shared workspace configuration.' }
$HostName = [string]$Local.host
if ($HostName -ne 'jobs.thegreatnovel.com') { throw 'Unexpected JobPilot hostname; review configuration before publishing.' }
$Service = 'http://127.0.0.1:3002'
$Api = 'https://api.cloudflare.com/client/v4'
$Token = [Environment]::GetEnvironmentVariable('JOBPILOT_CF_API_TOKEN', 'User')
if (-not $Token) { $Token = [Environment]::GetEnvironmentVariable('JINGYOU_CF_API_TOKEN', 'User') }
if (-not $Token) { throw 'Set a Cloudflare API token in the current user environment first.' }
$Headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
function Cf([string]$Method, [string]$Path, $Body = $null) {
    $Args = @{ Method=$Method; Uri="$Api$Path"; Headers=$Headers; ErrorAction='Stop' }
    if ($null -ne $Body) { $Args.Body = ($Body | ConvertTo-Json -Depth 50 -Compress); $Args.ContentType='application/json' }
    $R = Invoke-RestMethod @Args
    if (-not $R.success) { throw ($R.errors | ConvertTo-Json -Compress) }
    return $R.result
}
$Verify = Cf 'GET' '/user/tokens/verify'
if ($Verify.status -ne 'active') { throw 'Cloudflare token inactive.' }
$Zones = @(Cf 'GET' '/zones?name=thegreatnovel.com&status=active')
if ($Zones.Count -ne 1) { throw 'Expected one matching Cloudflare zone.' }
$Zone = [string]$Zones[0].id
$Account = [string]$Zones[0].account.id
$Tunnels = @(Cf 'GET' "/accounts/$Account/cfd_tunnel?is_deleted=false" | Where-Object { $_.name -eq 'TGN' })
if ($Tunnels.Count -ne 1 -or $Tunnels[0].status -ne 'healthy') { throw 'Existing TGN tunnel is not uniquely healthy.' }
$Tunnel = [string]$Tunnels[0].id
$Dns = @(Cf 'GET' "/zones/$Zone/dns_records?name=$HostName")
if ($Dns.Count -gt 1) { throw 'Multiple DNS records; refusing to choose one.' }
$Apps = @(Cf 'GET' "/accounts/$Account/access/apps?per_page=100")
$Domain = "$HostName/api/mobile-auth/bridge"
$Matches = @($Apps | Where-Object { $_.domain -eq $Domain -or $_.name -eq 'JobPilot' })
if ($Matches.Count -gt 1) { throw 'Multiple JobPilot Access applications; review manually.' }
$App = if ($Matches.Count -eq 1) { $Matches[0] } else { $null }
if ($App -and $App.domain -ne $Domain) { throw 'Existing JobPilot application has a different protected domain.' }
if ($App) {
    $Policies = @(Cf 'GET' "/accounts/$Account/access/apps/$($App.id)/policies")
    if (@($Policies | Where-Object { $_.name -ne 'JobPilot owner' }).Count) { throw 'Unexpected existing Access policy; refusing to replace it.' }
}
$Team = [Environment]::GetEnvironmentVariable('JINGYOU_CF_TEAM_DOMAIN','User')
if (-not $Team) { $Team = [string](Cf 'GET' "/accounts/$Account/access/organizations").auth_domain }
if (-not $Team) { throw 'Cloudflare Access team domain unavailable.' }
$Before = Cf 'GET' "/accounts/$Account/cfd_tunnel/$Tunnel/configurations"
Write-Output "TOKEN=active; TUNNEL=healthy; OWNER_COUNT=$($Emails.Count); DNS_COUNT=$($Dns.Count); ACCESS_COUNT=$($Matches.Count)"
if (-not $Apply) { Write-Output 'DRY_RUN=true'; exit 0 }
$BackupDirectory = Join-Path $Root '.career-ops-web\mobile-qa'
New-Item -ItemType Directory -Force $BackupDirectory | Out-Null
$Before | ConvertTo-Json -Depth 50 | Set-Content (Join-Path $BackupDirectory 'cloudflare-before-mobile.json') -Encoding UTF8
# Create a JobPilot-specific audience; other applications and login identities are untouched.
if (-not $App) {
    $AppBody = @{ name='JobPilot'; type='self_hosted'; domain=$Domain; session_duration='24h'; app_launcher_visible=$false; allow_iframe=$false }
    $Reference = @($Apps | Where-Object { $_.name -eq 'JingYou Health' }) | Select-Object -First 1
    if ($Reference.allowed_idps) { $AppBody.allowed_idps = @($Reference.allowed_idps) }
    $App = Cf 'POST' "/accounts/$Account/access/apps" $AppBody
}
$AppId = [string]$App.id
$PolicyBody = @{ name='JobPilot owner'; decision='allow'; include=@($Emails | ForEach-Object { @{ email=@{ email=$_ } } }); exclude=@(); require=@(); session_duration='24h' }
$Policies = @(Cf 'GET' "/accounts/$Account/access/apps/$AppId/policies")
$Policy = @($Policies | Where-Object { $_.name -eq 'JobPilot owner' }) | Select-Object -First 1
if ($Policy) { $null = Cf 'PUT' "/accounts/$Account/access/apps/$AppId/policies/$($Policy.id)" $PolicyBody }
else { $null = Cf 'POST' "/accounts/$Account/access/apps/$AppId/policies" $PolicyBody }
$Audience = [string]$App.aud
if (-not $Audience) { $Audience = [string](Cf 'GET' "/accounts/$Account/access/apps/$AppId").aud }
if (-not $Audience) { throw 'JobPilot audience missing.' }
$Local | Add-Member -NotePropertyName 'teamDomain' -NotePropertyValue $Team -Force
$Local | Add-Member -NotePropertyName 'audience' -NotePropertyValue $Audience -Force
[IO.File]::WriteAllText($LocalFile, ($Local | ConvertTo-Json -Depth 15), [Text.UTF8Encoding]::new($false))
# Read the latest whole config immediately before the write, preserving all unrelated rules and properties.
$Latest = Cf 'GET' "/accounts/$Account/cfd_tunnel/$Tunnel/configurations"
$Rules = @(); $Inserted = $false
foreach ($Rule in $Latest.config.ingress) {
    if ($Rule.hostname -eq $HostName) { continue }
    if (-not $Rule.hostname -and -not $Inserted) { $Rules += @{ hostname=$HostName; service=$Service }; $Inserted=$true }
    $Rules += $Rule
}
if (-not $Inserted) { throw 'The existing tunnel has no fallback rule; refusing an invalid configuration.' }
$Latest.config.ingress = $Rules
$null = Cf 'PUT' "/accounts/$Account/cfd_tunnel/$Tunnel/configurations" @{ config=$Latest.config }
$DesiredDns = @{ type='CNAME'; name=$HostName; content="$Tunnel.cfargotunnel.com"; proxied=$true; ttl=1 }
if ($Dns.Count -eq 0) { $null = Cf 'POST' "/zones/$Zone/dns_records" $DesiredDns }
elseif ($Dns[0].type -ne 'CNAME' -or $Dns[0].content -ne $DesiredDns.content -or -not $Dns[0].proxied) { $null = Cf 'PUT' "/zones/$Zone/dns_records/$($Dns[0].id)" $DesiredDns }
$After = Cf 'GET' "/accounts/$Account/cfd_tunnel/$Tunnel/configurations"
$UnrelatedBefore = @($Latest.config.ingress | Where-Object { $_.hostname -ne $HostName }) | ConvertTo-Json -Depth 30 -Compress
$UnrelatedAfter = @($After.config.ingress | Where-Object { $_.hostname -ne $HostName }) | ConvertTo-Json -Depth 30 -Compress
if ($UnrelatedBefore -ne $UnrelatedAfter) { throw 'Unrelated tunnel rules changed during provisioning; inspect without overwriting concurrent changes.' }
if (@($After.config.ingress | Where-Object { $_.hostname -eq $HostName -and $_.service -eq $Service }).Count -ne 1) { throw 'JobPilot ingress verification failed.' }
$FinalPolicy = @(Cf 'GET' "/accounts/$Account/access/apps/$AppId/policies")
if ($FinalPolicy.Count -ne 1 -or $FinalPolicy[0].decision -ne 'allow') { throw 'JobPilot policy verification failed.' }
$FinalDns = @(Cf 'GET' "/zones/$Zone/dns_records?name=$HostName")
if ($FinalDns.Count -ne 1 -or $FinalDns[0].content -ne $DesiredDns.content -or -not $FinalDns[0].proxied) { throw 'JobPilot DNS verification failed.' }
Write-Output "APPLY_OK=true; HOST=$HostName; SERVICE=$Service; UNRELATED_RULES=preserved; POLICY=workspace-members"
