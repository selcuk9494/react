# FR Rapor Bridge kaldirma — Yonetici PowerShell
$ErrorActionPreference = 'SilentlyContinue'
$ServiceName = 'FrRaporBridge'
$InstallDir = Join-Path ${env:ProgramFiles} 'FrRaporBridge'
$DataDir = Join-Path $env:ProgramData 'FrRaporBridge'

Stop-Service $ServiceName -Force
sc.exe stop $ServiceName | Out-Null
sc.exe delete $ServiceName | Out-Null
schtasks.exe /Delete /TN 'FrRaporBridgeWatchdog' /F | Out-Null
Remove-Item $InstallDir -Recurse -Force
Write-Host "Servis kaldirildi. Ayarlar (opsiyonel sil): $DataDir"
