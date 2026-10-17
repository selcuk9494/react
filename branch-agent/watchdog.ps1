$ErrorActionPreference = 'SilentlyContinue'
$InstallDir = Join-Path ${env:ProgramFiles} 'FrRaporBridge'
$winsw = Join-Path $InstallDir 'FrRaporBridge.exe'
$service = Get-Service -Name 'FrRaporBridge' -ErrorAction SilentlyContinue
if ($service) {
  if ($service.Status -ne 'Running') {
    if (Test-Path $winsw) { & $winsw start | Out-Null }
    else { Start-Service -Name 'FrRaporBridge' }
  }
  exit 0
}
# Servis yoksa baslangic gorevini dene
schtasks.exe /Run /TN 'FrRaporBridge' | Out-Null
