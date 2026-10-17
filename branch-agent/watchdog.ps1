$ErrorActionPreference = 'SilentlyContinue'
$service = Get-Service -Name 'FrRaporBridge'
if (-not $service) { exit 0 }
if ($service.Status -ne 'Running') {
  Start-Service -Name 'FrRaporBridge'
}
