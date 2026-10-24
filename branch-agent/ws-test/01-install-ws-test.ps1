# FrRaporBridge WS test — TEK test PC, Yonetici PowerShell
# Sira: discover -> yedek -> STOP -> kopya -> config -> START -> dogrula
# enroll/secret sifirlama YOK. SQL yazma YOK.
# Mevcut config.json: agentId, secret, cloudUrl, PostgreSQL alanlari KORUNUR;
# yalnizca transport=auto ve bridgeWsUrl guncellenir.
# Kullanim (onay sonrasi):
#   .\01-install-ws-test.ps1 -PackageDir 'C:\Temp\FrRaporBridge-WS-Test'
param(
  [Parameter(Mandatory = $true)]
  [string]$PackageDir
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $ok) { throw 'Yonetici PowerShell gerekli.' }
}

function Get-BridgeInstallDir {
  $svc = Get-CimInstance Win32_Service -Filter "Name='FrRaporBridge'"
  if (-not $svc) { throw 'FrRaporBridge servisi yok.' }
  $pathName = [string]$svc.PathName
  $exe = $null
  if ($pathName -match '^"([^"]+)"') { $exe = $Matches[1] }
  elseif ($pathName -match '^(\S+\.exe)') { $exe = $Matches[1] }
  else { $exe = $pathName.Trim().Split(' ')[0].Trim('"') }
  $dir = Split-Path -Parent $exe
  if (-not (Test-Path -LiteralPath (Join-Path $dir 'agent.js'))) {
    throw "InstallDir dogrulanamadi / agent.js yok: $dir (PathName=$pathName)"
  }
  return $dir
}

function Set-ConfigWsFields([string]$ConfigPath) {
  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "config.json yok: $ConfigPath"
  }
  $raw = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
  if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
  $cfg = $raw | ConvertFrom-Json
  if (-not $cfg.agentId -or -not $cfg.secret) {
    throw 'agentId/secret eksik — enroll etme; mevcut config gerekli.'
  }
  $keepAgentId = [string]$cfg.agentId
  $keepSecret = [string]$cfg.secret
  $keepCloud = [string]$cfg.cloudUrl

  # PowerShell 5.1: olmayan NoteProperty icin Add-Member
  if (-not ($cfg.PSObject.Properties.Name -contains 'transport')) {
    $cfg | Add-Member -MemberType NoteProperty -Name 'transport' -Value 'auto'
  } else {
    $cfg.transport = 'auto'
  }
  if (-not ($cfg.PSObject.Properties.Name -contains 'bridgeWsUrl')) {
    $cfg | Add-Member -MemberType NoteProperty -Name 'bridgeWsUrl' -Value 'wss://fr-bridge-server.onrender.com'
  } else {
    $cfg.bridgeWsUrl = 'wss://fr-bridge-server.onrender.com'
  }

  # agentId / secret / cloudUrl / pg* asla sifirlanmaz
  if ([string]$cfg.agentId -ne $keepAgentId -or [string]$cfg.secret -ne $keepSecret) {
    throw 'Guvenlik: agentId/secret degisti — yazma iptal.'
  }
  if ($keepCloud -and [string]$cfg.cloudUrl -ne $keepCloud) {
    throw 'Guvenlik: cloudUrl degisti — yazma iptal.'
  }

  $json = $cfg | ConvertTo-Json -Depth 10
  Set-Content -LiteralPath $ConfigPath -Value $json -Encoding UTF8
  Write-Host "config guncellendi transport=$($cfg.transport) bridgeWsUrl=$($cfg.bridgeWsUrl) agentId_set=True (secret/pg yazdirilmaz)"
}

function Copy-PackageNodeModules([string]$PackageDir, [string]$InstallDir) {
  $nmSrc = Join-Path $PackageDir 'node_modules'
  $nmDst = Join-Path $InstallDir 'node_modules'
  if (-not (Test-Path -LiteralPath (Join-Path $nmSrc 'ws\package.json'))) {
    throw "Paket node_modules\ws eksik: $nmSrc"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $nmSrc 'pg\package.json'))) {
    throw "Paket node_modules\pg eksik: $nmSrc"
  }

  # Onceki kurulumda wildcard kopya eksik birakabiliyordu: hedefi sifirla, agaci birebir kopyala
  if (Test-Path -LiteralPath $nmDst) {
    Remove-Item -LiteralPath $nmDst -Recurse -Force
  }
  Copy-Item -LiteralPath $nmSrc -Destination $nmDst -Recurse -Force

  $wsPkg = Join-Path $nmDst 'ws\package.json'
  $pgPkg = Join-Path $nmDst 'pg\package.json'
  if (-not (Test-Path -LiteralPath $wsPkg)) {
    throw "Kurulum hatasi: node_modules\ws hedefe gelmedi -> $nmDst"
  }
  if (-not (Test-Path -LiteralPath $pgPkg)) {
    throw "Kurulum hatasi: node_modules\pg hedefe gelmedi -> $nmDst"
  }
  Write-Host "node_modules kopyalandi: ws=OK pg=OK -> $nmDst"
}

Assert-Admin
$PackageDir = (Resolve-Path -LiteralPath $PackageDir).Path
$InstallDir = Get-BridgeInstallDir
$DataDir = Join-Path $env:ProgramData 'FrRaporBridge'
$ConfigPath = Join-Path $DataDir 'config.json'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $DataDir "backup-ws-test-$ts"

Write-Host "PackageDir=$PackageDir"
Write-Host "InstallDir=$InstallDir"
Write-Host "BackupRoot=$BackupRoot"

# Paket dogrulama
foreach ($f in @('agent.js','poll-policy.js','ws-transport.js','sql-safety.js','package.json')) {
  $p = Join-Path $PackageDir $f
  if (-not (Test-Path -LiteralPath $p)) { throw "Paket eksik: $f" }
}
if (-not (Test-Path -LiteralPath (Join-Path $PackageDir 'node_modules\ws\package.json'))) {
  throw 'Paket eksik: node_modules\ws'
}
if (-not (Test-Path -LiteralPath (Join-Path $PackageDir 'node_modules\pg\package.json'))) {
  throw 'Paket eksik: node_modules\pg'
}

# 1) YEDEK (servis hala ayakta — dosyalar kilitli olabilir; yine de kopyala)
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
Copy-Item -LiteralPath $InstallDir -Destination (Join-Path $BackupRoot 'FrRaporBridge-Program') -Recurse -Force
if (Test-Path -LiteralPath $ConfigPath) {
  Copy-Item -LiteralPath $ConfigPath -Destination (Join-Path $BackupRoot 'config.json') -Force
}
Set-Content -LiteralPath (Join-Path $BackupRoot 'INSTALL_DIR.txt') -Value $InstallDir -Encoding UTF8
Write-Host '[1/5] Yedek tamam'

# 2) STOP
Write-Host '[2/5] Servis durduruluyor...'
Stop-Service -Name 'FrRaporBridge' -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Get-Process -Name 'FrRaporBridge','node' -ErrorAction SilentlyContinue |
  Where-Object {
    try { $_.Path -and $_.Path.StartsWith($InstallDir, [StringComparison]::OrdinalIgnoreCase) }
    catch { $false }
  } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 3) DOSYA KOPYA
Write-Host '[3/5] Dosyalar kopyalaniyor...'
foreach ($f in @('agent.js','poll-policy.js','ws-transport.js','sql-safety.js','package.json')) {
  Copy-Item -LiteralPath (Join-Path $PackageDir $f) -Destination (Join-Path $InstallDir $f) -Force
}
Copy-PackageNodeModules -PackageDir $PackageDir -InstallDir $InstallDir

# 4) CONFIG
Write-Host '[4/5] config.json WS alanlari...'
Set-ConfigWsFields -ConfigPath $ConfigPath

# 5) START
Write-Host '[5/5] Servis baslatiliyor...'
Start-Service -Name 'FrRaporBridge'
Start-Sleep -Seconds 5
Get-Service -Name 'FrRaporBridge' | Format-List Name, Status

Write-Host "BackupRoot=$BackupRoot"
Write-Host 'Kurulum bitti. Dogrulama: 02-verify.ps1'
