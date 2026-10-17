# FR Rapor Bridge — Yonetici PowerShell ile calistirin.
# Ornek: powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path ${env:ProgramFiles} 'FrRaporBridge'
$DataDir = Join-Path $env:ProgramData 'FrRaporBridge'
$ServiceName = 'FrRaporBridge'
$CloudUrl = if ($env:FR_RAPOR_URL) { $env:FR_RAPOR_URL } else { 'https://react-delta-bice-16.vercel.app' }

function Assert-Admin {
  $ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $ok) { throw 'Yonetici olarak calistirin (PowerShell > Run as administrator).' }
}

Assert-Admin
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item (Join-Path $here 'agent.js') (Join-Path $InstallDir 'agent.js') -Force
Copy-Item (Join-Path $here 'run.cmd') (Join-Path $InstallDir 'run.cmd') -Force
Copy-Item (Join-Path $here 'watchdog.ps1') (Join-Path $InstallDir 'watchdog.ps1') -Force
Copy-Item (Join-Path $here 'package.json') (Join-Path $InstallDir 'package.json') -Force

# --- Node (tasinabilir) ---
$nodeDir = Join-Path $InstallDir 'node'
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCli = $null
if (-not (Test-Path $nodeExe)) {
  Write-Host 'Node indiriliyor (bir kez)...'
  $zip = Join-Path $env:TEMP 'fr-rapor-node.zip'
  $extract = Join-Path $env:TEMP 'fr-rapor-node'
  Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile $zip
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $extractedRoot = Get-ChildItem $extract -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  Copy-Item (Join-Path $extractedRoot.FullName '*') $nodeDir -Recurse -Force
}
$npmCli = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path $npmCli)) {
  $npmCli = Get-ChildItem $nodeDir -Recurse -Filter npm-cli.js | Select-Object -First 1 -ExpandProperty FullName
}

# --- pg bagimliligi ---
Write-Host 'Bagimliliklar kuruluyor...'
Push-Location $InstallDir
$env:PATH = "$nodeDir;$env:PATH"
if (Test-Path (Join-Path $here 'node_modules\pg')) {
  Copy-Item (Join-Path $here 'node_modules') (Join-Path $InstallDir 'node_modules') -Recurse -Force
} elseif (Test-Path $npmCli) {
  & $nodeExe $npmCli install --omit=dev --no-fund --no-audit
} else {
  throw 'npm bulunamadi; internet acik mi kontrol edin.'
}
Pop-Location

# --- Postgres bilgileri ---
$pgHost = Read-Host 'Postgres host [127.0.0.1]'
if (-not $pgHost) { $pgHost = '127.0.0.1' }
$pgPort = Read-Host 'Postgres port [5432]'
if (-not $pgPort) { $pgPort = '5432' }
$pgDatabase = Read-Host 'Veritabani adi [fastrest]'
if (-not $pgDatabase) { $pgDatabase = 'fastrest' }
$pgUser = Read-Host 'Kullanici [begum]'
if (-not $pgUser) { $pgUser = 'begum' }
$pgPasswordSecure = Read-Host 'Sifre' -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPasswordSecure)
$pgPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

@{
  cloudUrl = $CloudUrl
  pgHost = $pgHost
  pgPort = [int]$pgPort
  pgDatabase = $pgDatabase
  pgUser = $pgUser
  pgPassword = $pgPassword
} | ConvertTo-Json | Set-Content (Join-Path $DataDir 'config.json') -Encoding UTF8

# --- Windows Service: auto + crash'te 1 sn'de yeniden ---
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Seconds 2
}

# cmd dongusu (run.cmd) + sc failure = cift koruma
$binPath = "cmd.exe /c `"$InstallDir\run.cmd`""
sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= "FR Rapor Bridge" | Out-Null
sc.exe description $ServiceName "FR Rapor yerel FastRest Postgres koprusu" | Out-Null
sc.exe failure $ServiceName reset= 0 actions= restart/1000/restart/1000/restart/1000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null
sc.exe config $ServiceName start= auto | Out-Null
Start-Service $ServiceName

# --- 1 dakikada bir watchdog ---
schtasks.exe /Delete /TN 'FrRaporBridgeWatchdog' /F 2>$null | Out-Null
schtasks.exe /Create /TN 'FrRaporBridgeWatchdog' /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /F `
  /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\watchdog.ps1`"" | Out-Null

Write-Host 'Servis basladi, esleme kodu bekleniyor...'
$codeFile = Join-Path $DataDir 'PAIR-CODE.txt'
for ($i = 0; $i -lt 25; $i++) {
  if (Test-Path $codeFile) { break }
  Start-Sleep -Seconds 1
}
Write-Host ''
if (Test-Path $codeFile) {
  Write-Host '======== ESLEME KODU ========'
  Get-Content $codeFile
  Write-Host '============================='
  Write-Host "Dosya: $codeFile (Masaustunde FR-RAPOR-KOD.txt da olabilir)"
} else {
  Write-Host "Kod henuz yazilmadi. Log: $DataDir\bridge.log"
  Write-Host "Kod dosyasi: $codeFile"
}
