#!/usr/bin/env bash
# 01-install-ws-test.ps1 Copy-PackageNodeModules davranisini yerel olarak dogrular.
# Windows servisine dokunmaz.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="${1:-$ROOT/dist/FrRaporBridge-WS-Test}"
FAKE_INSTALL="$(mktemp -d)/FrRaporBridge-Program"
mkdir -p "$FAKE_INSTALL"
# Eski kurulum: pg var, ws YOK (onceki hata senaryosu)
mkdir -p "$FAKE_INSTALL/node_modules/pg"
echo '{"name":"pg"}' > "$FAKE_INSTALL/node_modules/pg/package.json"
echo '// stub' > "$FAKE_INSTALL/agent.js"

test -f "$PKG/node_modules/ws/package.json" || { echo "FAIL: paket ws yok: $PKG"; exit 1; }
test -f "$PKG/agent.js" || { echo "FAIL: paket agent.js yok"; exit 1; }

for f in agent.js poll-policy.js ws-transport.js sql-safety.js package.json; do
  cp "$PKG/$f" "$FAKE_INSTALL/$f"
done

# PS: Remove-Item node_modules; Copy-Item package node_modules
rm -rf "$FAKE_INSTALL/node_modules"
cp -R "$PKG/node_modules" "$FAKE_INSTALL/node_modules"

test -f "$FAKE_INSTALL/node_modules/ws/package.json" || { echo "FAIL: hedefte ws yok"; exit 1; }
test -f "$FAKE_INSTALL/node_modules/pg/package.json" || { echo "FAIL: hedefte pg yok"; exit 1; }

# require path check
(
  cd "$FAKE_INSTALL"
  node -e "require('ws'); require('pg'); console.log('OK: require ws+pg from fake install');"
)

# via log present in installed agent
grep -q 'via=${channel}' "$FAKE_INSTALL/agent.js" || { echo "FAIL: via log yok"; exit 1; }

echo "OK: simulate-install-copy -> $FAKE_INSTALL"
rm -rf "$(dirname "$FAKE_INSTALL")"
