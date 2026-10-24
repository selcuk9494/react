# WS auth / HTTP fallback / Render agents kontrolu — secret yazdirmaz
# SQL yazma / fatura YOK
param(
  [int]$WaitSeconds = 20
)

$ErrorActionPreference = 'Continue'
$DataDir = Join-Path $env:ProgramData 'FrRaporBridge'
$LogPath = Join-Path $DataDir 'bridge.log'

Write-Host "=== SERVICE ==="
Get-Service -Name 'FrRaporBridge' -ErrorAction SilentlyContinue | Format-List Name, Status

Write-Host "=== LOG TAIL (son 50) ==="
if (Test-Path $LogPath) {
  Get-Content -LiteralPath $LogPath -Tail 50
} else {
  Write-Host 'bridge.log yok'
}

Write-Host "=== LOG ANAHTAR KELIMELER ==="
if (Test-Path $LogPath) {
  $tail = Get-Content -LiteralPath $LogPath -Tail 200
  $tail | Select-String -Pattern 'ws baglaniyor|ws acildi|ws auth|ws kapali|HTTP poll fallback|poll politikasi|transport=|via=ws|via=http|jobs received via=' |
    Select-Object -Last 30
}

Write-Host "Bekleniyor ${WaitSeconds}s (Render Free cold start)..."
Start-Sleep -Seconds $WaitSeconds

Write-Host "=== RENDER HEALTH ==="
try {
  $h = Invoke-RestMethod -Uri 'https://fr-bridge-server.onrender.com/health' -TimeoutSec 60
  $h | ConvertTo-Json -Depth 6
  Write-Host "agents=$($h.agents) ok=$($h.ok) postgres.ok=$($h.postgres.ok) listen.ok=$($h.listen.ok)"
  if ([int]$h.agents -ge 1) {
    Write-Host 'SONUC: agents>=1 — WS baglantisi basarili gorunuyor'
  } else {
    Write-Host 'SONUC: agents hala 0 — logda ws/auth hatalarina bak'
  }
} catch {
  Write-Host "health hata: $($_.Exception.Message)"
}

Write-Host '=== VERIFY BITTI (SQL yazma yapilmadi) ==='
