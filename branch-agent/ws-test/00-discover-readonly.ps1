# Salt okuma: FrRaporBridge gercek executable / calisma klasoru
# Varsayim YOK — Program Files yolunu hardcode etme.
$ErrorActionPreference = 'Continue'

Write-Host '=== SERVICE ==='
Get-Service -Name 'FrRaporBridge' -ErrorAction SilentlyContinue |
  Format-List Name, Status, StartType, DisplayName

$svc = Get-CimInstance Win32_Service -Filter "Name='FrRaporBridge'" -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host 'FrRaporBridge Windows Service bulunamadi.'
  exit 1
}
Write-Host "State=$($svc.State)"
Write-Host "StartMode=$($svc.StartMode)"
Write-Host "PathName=$($svc.PathName)"

# PathName ornekleri:
# "C:\Program Files\FrRaporBridge\FrRaporBridge.exe"
# "C:\...\FrRaporBridge.exe"  (WinSW)
$pathName = [string]$svc.PathName
$exe = $null
if ($pathName -match '^"([^"]+)"') { $exe = $Matches[1] }
elseif ($pathName -match '^(\S+\.exe)') { $exe = $Matches[1] }
else { $exe = $pathName.Trim().Split(' ')[0].Trim('"') }

$installDir = Split-Path -Parent $exe
Write-Host "ResolvedExe=$exe"
Write-Host "InstallDir=$installDir"
Write-Host "ExeExists=$(Test-Path -LiteralPath $exe)"
Write-Host "AgentJsExists=$(Test-Path -LiteralPath (Join-Path $installDir 'agent.js'))"
Write-Host "NodeExeExists=$(Test-Path -LiteralPath (Join-Path $installDir 'node\node.exe'))"

$dataDir = Join-Path $env:ProgramData 'FrRaporBridge'
Write-Host "DataDir=$dataDir exists=$(Test-Path $dataDir)"
Write-Host "ConfigExists=$(Test-Path (Join-Path $dataDir 'config.json'))"

# WinSW xml workingdirectory ipucu
$xml = Join-Path $installDir 'FrRaporBridge.xml'
if (Test-Path $xml) {
  Write-Host "XmlExists=True path=$xml"
}
Write-Host '=== DISCOVER BITTI (salt okuma) ==='
