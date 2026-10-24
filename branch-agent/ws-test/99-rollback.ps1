# WS test geri alma — yedek klasorunden dosya + config geri yukle
# Kullanim (Yonetici):
#   .\99-rollback.ps1 -BackupRoot 'C:\ProgramData\FrRaporBridge\backup-ws-test-YYYYMMDD-HHMMSS'
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupRoot,
  [switch]$HttpOnly
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $ok) { throw 'Yonetici PowerShell gerekli.' }
}

Assert-Admin
$BackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path
$progBackup = Join-Path $BackupRoot 'FrRaporBridge-Program'
$cfgBackup = Join-Path $BackupRoot 'config.json'
$installDirFile = Join-Path $BackupRoot 'INSTALL_DIR.txt'
if (-not (Test-Path -LiteralPath $progBackup)) { throw "Yedek program klasoru yok: $progBackup" }
if (-not (Test-Path -LiteralPath $cfgBackup)) { throw "Yedek config yok: $cfgBackup" }

$InstallDir = if (Test-Path $installDirFile) {
  (Get-Content -LiteralPath $installDirFile -Raw).Trim()
} else {
  $svc = Get-CimInstance Win32_Service -Filter "Name='FrRaporBridge'"
  $pathName = [string]$svc.PathName
  if ($pathName -match '^"([^"]+)"') { Split-Path -Parent $Matches[1] }
  else { throw 'InstallDir cozulemedi; INSTALL_DIR.txt gerekli.' }
}

$ConfigPath = Join-Path $env:ProgramData 'FrRaporBridge\config.json'

Write-Host "Rollback InstallDir=$InstallDir"
Write-Host "BackupRoot=$BackupRoot"

Write-Host '[1/4] Servis durduruluyor...'
Stop-Service -Name 'FrRaporBridge' -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host '[2/4] Program dosyalari geri yukleniyor...'
Copy-Item -Path (Join-Path $progBackup '*') -Destination $InstallDir -Recurse -Force

Write-Host '[3/4] config.json geri yukleniyor...'
Copy-Item -LiteralPath $cfgBackup -Destination $ConfigPath -Force

if ($HttpOnly) {
  $raw = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
  if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
  $cfg = $raw | ConvertFrom-Json
  if (-not ($cfg.PSObject.Properties.Name -contains 'transport')) {
    $cfg | Add-Member -MemberType NoteProperty -Name 'transport' -Value 'http'
  } else {
    $cfg.transport = 'http'
  }
  $cfg | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
  Write-Host 'transport=http zorlandi'
}

Write-Host '[4/4] Servis baslatiliyor...'
Start-Service -Name 'FrRaporBridge'
Start-Sleep -Seconds 3
Get-Service -Name 'FrRaporBridge' | Format-List Name, Status
Write-Host 'Rollback bitti.'
