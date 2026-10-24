# FR Rapor Bridge - tek tikla kurulum (KUR.bat ile cagirin)
$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path ${env:ProgramFiles} 'FrRaporBridge'
$DataDir = Join-Path $env:ProgramData 'FrRaporBridge'
$ServiceName = 'FrRaporBridge'
$CloudUrl = if ($env:FR_RAPOR_URL) { $env:FR_RAPOR_URL } else { 'https://react-delta-bice-16.vercel.app' }

function Assert-Admin {
  $ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $ok) { throw 'Yonetici olarak calistirin. KUR.bat dosyasina cift tiklayin.' }
}

Assert-Admin
Write-Host ''
Write-Host '========================================'
Write-Host '  FR Rapor Bridge - Kurulum'
Write-Host '========================================'
Write-Host ''

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$winswSrc = Join-Path $here 'vendor\WinSW-x64.exe'
$winswDst = Join-Path $InstallDir 'FrRaporBridge.exe'
if (-not (Test-Path $winswSrc)) {
  throw "Eksik dosya: vendor\WinSW-x64.exe - kurulum paketini bozmadan kopyalayin."
}

Write-Host '[1/5] Mevcut servis durduruluyor...'
$ErrorActionPreference = 'Continue'
Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
if (Test-Path $winswDst) { & $winswDst stop 2>$null | Out-Null }
sc.exe stop $ServiceName 2>$null | Out-Null
Start-Sleep -Seconds 2
Get-Process -Name 'FrRaporBridge' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$ErrorActionPreference = 'Stop'

Write-Host '[2/5] Dosyalar kopyalaniyor...'
Copy-Item (Join-Path $here 'agent.js') (Join-Path $InstallDir 'agent.js') -Force
Copy-Item (Join-Path $here 'poll-policy.js') (Join-Path $InstallDir 'poll-policy.js') -Force
Copy-Item (Join-Path $here 'ws-transport.js') (Join-Path $InstallDir 'ws-transport.js') -Force
Copy-Item (Join-Path $here 'sql-safety.js') (Join-Path $InstallDir 'sql-safety.js') -Force
Copy-Item (Join-Path $here 'run.cmd') (Join-Path $InstallDir 'run.cmd') -Force
Copy-Item (Join-Path $here 'watchdog.ps1') (Join-Path $InstallDir 'watchdog.ps1') -Force
Copy-Item (Join-Path $here 'package.json') (Join-Path $InstallDir 'package.json') -Force
Copy-Item (Join-Path $here 'FrRaporBridge.xml') (Join-Path $InstallDir 'FrRaporBridge.xml') -Force
Copy-Item (Join-Path $here 'set-password.ps1') (Join-Path $InstallDir 'set-password.ps1') -Force -ErrorAction SilentlyContinue
try { Copy-Item $winswSrc $winswDst -Force } catch { Write-Host '  WinSW zaten yerinde, devam.' }

$nodeDir = Join-Path $InstallDir 'node'
$nodeExe = Join-Path $nodeDir 'node.exe'
$localZip = Join-Path $here 'vendor\node-v20.18.1-win-x64.zip'

function Expand-NodeZip([string]$zipPath) {
  $extract = Join-Path $env:TEMP 'fr-rapor-node'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $extract -Force
  $extractedRoot = Get-ChildItem $extract -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  Copy-Item (Join-Path $extractedRoot.FullName '*') $nodeDir -Recurse -Force
}

if (-not (Test-Path $nodeExe)) {
  if (-not (Test-Path $localZip)) { throw 'Eksik: vendor\node-v20.18.1-win-x64.zip' }
  Write-Host '  Node aciliyor (internet gerekmez)...'
  Expand-NodeZip $localZip
}
if (-not (Test-Path $nodeExe)) { throw "node.exe yok: $nodeExe" }

$srcModules = Join-Path $here 'node_modules'
if (-not (Test-Path (Join-Path $srcModules 'pg'))) {
  throw 'Eksik: node_modules\pg - kurulum paketini bozmadan kopyalayin.'
}
Copy-Item $srcModules (Join-Path $InstallDir 'node_modules') -Recurse -Force

Write-Host '[3/5] Postgres ayarlari...'
$prev = @{}
$cfgPath = Join-Path $DataDir 'config.json'
if (Test-Path $cfgPath) {
  try { $prev = Get-Content $cfgPath -Raw | ConvertFrom-Json } catch {}
}

$pgHost = if ($prev.pgHost) { [string]$prev.pgHost } else { '127.0.0.1' }
$pgPort = if ($prev.pgPort) { [int]$prev.pgPort } else { 5432 }
$pgDatabase = if ($prev.pgDatabase) { [string]$prev.pgDatabase } else { 'fastrest' }
$pgUser = if ($prev.pgUser) { [string]$prev.pgUser } else { 'begum' }

Write-Host "  Host: $pgHost  Port: $pgPort  DB: $pgDatabase  User: $pgUser"
Write-Host '  (Degistirmek icin Enter yerine deger yazin)'

$in = Read-Host "  Postgres host [$pgHost]"
if ($in) { $pgHost = $in }
$in = Read-Host "  Postgres port [$pgPort]"
if ($in) { $pgPort = [int]$in }
$in = Read-Host "  Veritabani adi [$pgDatabase]"
if ($in) { $pgDatabase = $in }
$in = Read-Host "  Kullanici [$pgUser]"
if ($in) { $pgUser = $in }

function Read-PlainPassword([string]$prompt) {
  $sec = Read-Host $prompt -AsSecureString
  $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
  }
}

function Save-ConfigJson($path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 6
  # BOM yazma - Node JSON.parse BOM'da patlar ve sifreyi siler
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $json, $utf8)
}

$pgPassword = ''
while (-not $pgPassword) {
  $p1 = Read-PlainPassword '  Postgres sifresi (begum)'
  if (-not $p1) {
    if ($prev.pgPassword) {
      $keep = Read-Host '  Bos birakildi. Onceki sifre korunsun mu? [E/h]'
      if ($keep -notin @('h', 'H', 'n', 'N')) {
        $pgPassword = [string]$prev.pgPassword
        Write-Host '  Onceki sifre korundu.'
        break
      }
    }
    Write-Host '  Sifre bos olamaz - tekrar deneyin.'
    continue
  }
  $p2 = Read-PlainPassword '  Sifreyi tekrar girin'
  if ($p1 -ne $p2) {
    Write-Host '  Sifreler uyusmadi - tekrar deneyin.'
    continue
  }
  $pgPassword = $p1
}

$cfgOut = [ordered]@{
  cloudUrl = $CloudUrl
  pgHost = $pgHost
  pgPort = [int]$pgPort
  pgDatabase = $pgDatabase
  pgUser = $pgUser
  pgPassword = $pgPassword
}
if ($prev.agentId) { $cfgOut['agentId'] = $prev.agentId }
if ($prev.secret) { $cfgOut['secret'] = $prev.secret }
if ($prev.pairCode) { $cfgOut['pairCode'] = $prev.pairCode }
Save-ConfigJson $cfgPath $cfgOut

# Dosyadan geri oku - BOM / yazma hatasi yakala
$rawBytes = [System.IO.File]::ReadAllBytes($cfgPath)
if ($rawBytes.Length -ge 3 -and $rawBytes[0] -eq 0xEF -and $rawBytes[1] -eq 0xBB -and $rawBytes[2] -eq 0xBF) {
  throw 'Config BOM ile yazildi (hata). Kurulumu guncel paketten tekrar calistirin.'
}
$check = $null
try {
  $check = (Get-Content $cfgPath -Raw -Encoding UTF8) | ConvertFrom-Json
} catch {
  throw "config.json okunamadi: $($_.Exception.Message)"
}
$pwdLen = if ($check.pgPassword) { [string]$check.pgPassword.Length } else { 0 }
if ($pwdLen -lt 1) { throw 'Sifre config.json icine yazilamadi - kurulum durdu.' }
if ([string]$check.pgPassword -ne [string]$pgPassword) {
  throw 'Kaydedilen sifre eslesmiyor - kurulum durdu.'
}
Write-Host "  Sifre kaydedildi ($pwdLen karakter)."
Write-Host '  Not: FR Rapor Admin > DB sifre alani agent subelerde BOS gorunur - dogrudur.'
Write-Host '       Gercek sifre sadece: C:\ProgramData\FrRaporBridge\config.json'

# Servis hesabinin okuyabilmesi icin ACL
icacls $DataDir /grant "Users:(OI)(CI)R" /T 2>$null | Out-Null
icacls $cfgPath /grant "SYSTEM:F" "Administrators:F" 2>$null | Out-Null

# Postgres baglanti testi - basarisizsa servis KURULMAZ
# Test dosyasi InstallDir'de olmali ki require('pg') node_modules'u bulsun
Write-Host '  Postgres baglantisi test ediliyor...'
$testJs = @"
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.H,
  port: Number(process.env.P || 5432),
  database: process.env.D,
  user: process.env.U,
  password: process.env.PGPASSWORD || '',
  connectionTimeoutMillis: 5000,
});
p.query('select current_database() as db, current_user as u')
  .then((r) => {
    console.log('OK', r.rows[0].db, r.rows[0].u);
    return p.end();
  })
  .catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
"@
$testFile = Join-Path $InstallDir 'pg-test.js'
[System.IO.File]::WriteAllText($testFile, $testJs, (New-Object System.Text.UTF8Encoding $false))
$env:H = $pgHost
$env:P = "$pgPort"
$env:D = $pgDatabase
$env:U = $pgUser
$env:PGPASSWORD = $pgPassword
$testOut = ''
Push-Location $InstallDir
try {
  $testOut = & $nodeExe $testFile 2>&1 | Out-String
  $pgTestOk = ($LASTEXITCODE -eq 0)
} finally {
  Pop-Location
  Remove-Item $testFile -Force -ErrorAction SilentlyContinue
  $env:PGPASSWORD = ''
}
Write-Host $testOut.Trim()
if (-not $pgTestOk) {
  throw @"
Postgres baglanamadi. Servis kurulmadi.
Host=$pgHost Port=$pgPort DB=$pgDatabase User=$pgUser
Hata: $($testOut.Trim())
Postgres calisiyor mu / sifre dogru mu kontrol edip KUR.bat ile tekrar deneyin.
"@
}
Write-Host '  Postgres OK.'

Write-Host '[4/5] Windows servisi kuruluyor...'
$ErrorActionPreference = 'Continue'
if (Test-Path $winswDst) {
  & $winswDst stop 2>$null | Out-Null
  & $winswDst uninstall 2>$null | Out-Null
}
sc.exe stop $ServiceName 2>$null | Out-Null
sc.exe delete $ServiceName 2>$null | Out-Null
schtasks.exe /Delete /TN 'FrRaporBridge' /F 2>$null | Out-Null
schtasks.exe /Delete /TN 'FrRaporBridgeWatchdog' /F 2>$null | Out-Null
Start-Sleep -Seconds 2
$ErrorActionPreference = 'Stop'

Push-Location $InstallDir
& .\FrRaporBridge.exe install 2>&1 | Out-Host
& .\FrRaporBridge.exe start 2>&1 | Out-Host
Pop-Location

Start-Sleep -Seconds 2
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host '  Servis gorunmedi, baslangic gorevi kuruluyor...'
  $tr = "`"$InstallDir\run.cmd`""
  schtasks.exe /Create /TN 'FrRaporBridge' /SC ONSTART /RU SYSTEM /RL HIGHEST /F /TR $tr | Out-Null
  schtasks.exe /Run /TN 'FrRaporBridge' | Out-Null
} else {
  if ($svc.Status -ne 'Running') { Start-Service $ServiceName }
  Write-Host "  Servis: $((Get-Service $ServiceName).Status)"
}

$watchPs1 = Join-Path $InstallDir 'watchdog.ps1'
$watchTr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$watchPs1'"
cmd.exe /c "schtasks /Create /TN FrRaporBridgeWatchdog /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /F /TR `"$watchTr`"" | Out-Null

# Servis actiktan sonra sifre hala duruyor mu? (eski BOM bug kontrolu)
Start-Sleep -Seconds 2
$after = (Get-Content $cfgPath -Raw -Encoding UTF8) | ConvertFrom-Json
if (-not $after.pgPassword -or [string]$after.pgPassword.Length -lt 1) {
  # Kurtar: sifreyi tekrar yaz
  $after | Add-Member -NotePropertyName pgPassword -NotePropertyValue $pgPassword -Force
  $fix = [ordered]@{
    cloudUrl = $after.cloudUrl; pgHost = $after.pgHost; pgPort = [int]$after.pgPort
    pgDatabase = $after.pgDatabase; pgUser = $after.pgUser; pgPassword = $pgPassword
  }
  if ($after.agentId) { $fix['agentId'] = $after.agentId }
  if ($after.secret) { $fix['secret'] = $after.secret }
  if ($after.pairCode) { $fix['pairCode'] = $after.pairCode }
  Save-ConfigJson $cfgPath $fix
  Write-Host '  UYARI: Servis sifreyi silmisti, yeniden yazildi. agent.js guncel mi kontrol edin.'
  if (Test-Path $winswDst) { & $winswDst restart 2>&1 | Out-Null }
} else {
  Write-Host ("  Config sifre kontrolu OK ({0} karakter)." -f $after.pgPassword.Length)
}

Write-Host '[5/5] Esleme kodu bekleniyor (internet gerekli)...'
$codeFile = Join-Path $DataDir 'PAIR-CODE.txt'
for ($i = 0; $i -lt 40; $i++) {
  if (Test-Path $codeFile) {
    $txt = Get-Content $codeFile -Raw
    if ($txt -match '[A-Z0-9]{3}-[A-Z0-9]{3}') { break }
  }
  Start-Sleep -Seconds 1
}

Write-Host ''
Write-Host '========================================'
if (Test-Path $codeFile) {
  Get-Content $codeFile
  Write-Host '========================================'
  Write-Host ''
  Write-Host 'FR RAPOR:'
  Write-Host '  Admin > Subeler > Yeni Sube > "Kod ile bagla"'
  Write-Host '  Bu kodu bir kez yazin. Sonrasi kalicidir.'
  Write-Host ''
  Write-Host "Kod dosyasi: $codeFile"
} else {
  Write-Host ' Kod henuz olusmadi.'
  Write-Host " Log: $DataDir\bridge.log"
  Write-Host ' Internet/DNS kontrol edin, sonra servisi yeniden baslatin:'
  Write-Host '   & "C:\Program Files\FrRaporBridge\FrRaporBridge.exe" restart'
  Write-Host '========================================'
  if (Test-Path (Join-Path $DataDir 'bridge.log')) {
    Get-Content (Join-Path $DataDir 'bridge.log') -Tail 15
  }
}
Write-Host ''
