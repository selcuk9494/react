#!/bin/bash
# Paylasilabilir tek-tik kurulum zip'i olusturur.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${ROOT}/dist"
NAME="FrRaporBridge-Kurulum"
STAGE="${OUT_DIR}/${NAME}"

need=(
  KUR.bat install.ps1 uninstall.ps1 set-password.ps1
  agent.js run.cmd watchdog.ps1 package.json FrRaporBridge.xml
  KURULUM.txt
  vendor/WinSW-x64.exe
  vendor/node-v20.18.1-win-x64.zip
  node_modules/pg
)

echo "Kontrol..."
for f in "${need[@]}"; do
  if [[ ! -e "$ROOT/$f" ]]; then
    echo "EKSIK: $f"
    exit 1
  fi
done

rm -rf "$STAGE"
mkdir -p "$STAGE/vendor"
cp "$ROOT/KUR.bat" "$ROOT/install.ps1" "$ROOT/uninstall.ps1" "$ROOT/set-password.ps1" \
   "$ROOT/agent.js" "$ROOT/run.cmd" "$ROOT/watchdog.ps1" "$ROOT/package.json" \
   "$ROOT/FrRaporBridge.xml" "$ROOT/KURULUM.txt" "$STAGE/"
cp "$ROOT/vendor/WinSW-x64.exe" "$ROOT/vendor/node-v20.18.1-win-x64.zip" "$STAGE/vendor/"
cp -R "$ROOT/node_modules" "$STAGE/"

# BOM for PS 5.1
python3 - <<PY
from pathlib import Path
stage = Path("$STAGE")
for name in ("install.ps1", "uninstall.ps1", "set-password.ps1", "watchdog.ps1"):
    p = stage / name
    if p.exists():
        t = p.read_text(encoding="utf-8-sig")
        p.write_bytes(b"\xef\xbb\xbf" + t.encode("utf-8"))
print("BOM ok")
PY

ZIP="${OUT_DIR}/${NAME}.zip"
rm -f "$ZIP"
(
  cd "$OUT_DIR"
  zip -r -q "${NAME}.zip" "$NAME"
)
SIZE=$(du -h "$ZIP" | awk '{print $1}')
echo ""
echo "Hazir: $ZIP ($SIZE)"
echo "Musteriye bu zip'i gonderin. Icinden KUR.bat'a cift tiklatın."
