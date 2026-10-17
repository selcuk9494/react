# Postgres sifresini config'e yazar ve servisi yeniden baslatir.
# Yonetici PowerShell gerekir.
$ErrorActionPreference = 'Stop'
$ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ok) { throw 'Yonetici olarak calistirin (PowerShell > Run as administrator).' }

$cfgPath = Join-Path $env:ProgramData 'FrRaporBridge\config.json'
if (-not (Test-Path $cfgPath)) { throw "Config yok: $cfgPath" }

$secure = Read-Host 'Postgres sifresi (begum)' -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}
if (-not $plain) { throw 'Sifre bos olamaz.' }

$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.pgPassword = $plain
$json = $cfg | ConvertTo-Json -Depth 6
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($cfgPath, $json, $utf8)

$check = Get-Content $cfgPath -Raw | ConvertFrom-Json
Write-Host ("Sifre kaydedildi ({0} karakter)." -f $check.pgPassword.Length)
Write-Host 'Not: FR Rapor Admin ekranindaki DB sifre alani agent subelerde BOS kalir - dogrudur.'

$winsw = Join-Path ${env:ProgramFiles} 'FrRaporBridge\FrRaporBridge.exe'
# Guncel agent.js varsa kopyala
$srcAgent = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'agent.js'
if (Test-Path $srcAgent) {
  Copy-Item $srcAgent (Join-Path ${env:ProgramFiles} 'FrRaporBridge\agent.js') -Force -ErrorAction SilentlyContinue
}
if (Test-Path $winsw) {
  & $winsw restart
  Write-Host 'Servis yeniden baslatildi.'
} else {
  Restart-Service FrRaporBridge -Force
}
