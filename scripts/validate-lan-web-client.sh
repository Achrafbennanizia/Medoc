#!/usr/bin/env bash
# Build the browser-only LAN web client (no Tauri).
set -euo pipefail
cd "$(dirname "$0")/.."

if rg -q '@tauri-apps/' apps/lan-web-client/src apps/lan-web-client/package.json 2>/dev/null; then
  echo "FAIL: lan-web-client must not reference @tauri-apps"
  exit 1
fi

echo "==> LAN web client (medoc-lan-web-client)"
npm run build -w medoc-lan-web-client
echo "LAN web client built successfully."
