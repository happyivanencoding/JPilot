param([switch]$RestartWeb, [switch]$RestartGateway, [switch]$UsbDebug)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Runner = Join-Path $PSScriptRoot 'run-mobile-service.ps1'
$Shell = (Get-Command powershell.exe -ErrorAction Stop).Source
$User = [Security.Principal.WindowsIdentity]::GetCurrent().Name
if (-not (Test-Path (Join-Path $Root 'web\.next\BUILD_ID'))) { throw 'Build the Web project before starting production services.' }
function Ensure-Service([int]$Port,[string]$Label,[bool]$Restart) {
    $Name = "JobPilot $Label"
    $ExistingTask = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($ExistingTask -and -not ([string]$ExistingTask.Actions.Arguments).Contains($Runner)) { throw "Task $Name belongs to another installation; not replacing it." }
    $Connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($Connection) {
        $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $($Connection.OwningProcess)"
        if (-not $Process.CommandLine -or -not $Process.CommandLine.Contains($Root)) { throw "Port $Port belongs to another application." }
        if (-not $Restart) { Write-Output "$Label already listening on $Port"; return }
        if ($ExistingTask) { Stop-ScheduledTask -TaskName $Name }
        Stop-Process -Id $Connection.OwningProcess -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 400
    }
    $Arguments = "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Runner`" -Service $Label"
    if ($Label -eq 'gateway' -and $UsbDebug) { $Arguments += ' -UsbDebug' }
    $Action = New-ScheduledTaskAction -Execute $Shell -Argument $Arguments -WorkingDirectory (Join-Path $Root 'web')
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
    $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
    $Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description 'Owner-local JobPilot service, independent from AgentDock command sessions.' -Force | Out-Null
    Start-ScheduledTask -TaskName $Name
    Write-Output "$Name scheduled and started on port $Port"
}
Ensure-Service 3000 'web' $RestartWeb
Ensure-Service 3002 'gateway' $RestartGateway
Write-Output 'Services run independently of this command and restart at owner logon. Public access uses port 3002 only.'
