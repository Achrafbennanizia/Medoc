#!/usr/bin/env bash
# Reset local MeDoc onboarding state for a clean owner activation test (macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DATA="${HOME}/Library/Application Support/de.medoc.app"
DEV_ACT="${ROOT}/.dev-activation"
KEYGEN="${ROOT}/installer/dist/medoc-keygen-darwin-arm64"
TS="$(date +%Y%m%d-%H%M%S)"

echo "Stopping MeDoc dev processes…"
pkill -f "target/debug/medoc" 2>/dev/null || true
pkill -f "tauri dev" 2>/dev/null || true
lsof -ti :1420 | xargs kill -9 2>/dev/null || true
sleep 1

mkdir -p "${APP_DATA}/backups" "${DEV_ACT}"

if [[ -f "${APP_DATA}/medoc.db" ]]; then
  mv "${APP_DATA}/medoc.db" "${APP_DATA}/backups/medoc-reset-${TS}.db"
  echo "Backed up medoc.db"
fi
rm -f "${APP_DATA}/medoc.db-wal" "${APP_DATA}/medoc.db-shm" "${APP_DATA}/db-key.wrap" "${APP_DATA}/db-key.salt"

for account in sqlcipher-key verbund-device-signing-key pairing-master-signing-key; do
  security delete-generic-password -s "de.medoc.app" -a "${account}" 2>/dev/null || true
done
echo "Cleared keychain entries for de.medoc.app"

echo 'correct horse battery staple' > "${DEV_ACT}/pw.txt"
"${KEYGEN}" --out "${DEV_ACT}/activation.json" --passphrase-file "${DEV_ACT}/pw.txt"

echo ""
echo "=== Fresh activation manifest ==="
echo "Path:       ${DEV_ACT}/activation.json"
echo "Passphrase: correct horse battery staple"
echo ""
echo "Start the app, then import activation in the UI:"
echo "  bash tools/dev-tauri.sh"
echo ""
echo "Optional headless import (dev only — can confuse demo seed; app must be stopped):"
echo "  MEDOC_HEADLESS_ACTIVATION=1 cargo test -p medoc-sync headless_dev_activation -- --ignored --nocapture"
