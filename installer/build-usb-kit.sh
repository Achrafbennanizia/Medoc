#!/usr/bin/env bash
# Package USB kit: medoc-usb-setup + practice NSIS + medoc-server payloads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${ROOT}/installer/dist/usb-kit"
mkdir -p "$OUT/medoc-usb/payloads"

echo "Building medoc-usb-setup..."
cargo build -p medoc-usb-setup --release

echo "Building medoc-server..."
cargo build -p medoc-lan-server --release

OS="$(uname -s)"
ARCH="$(uname -m)"
SETUP_BIN="installer/target/release/medoc-usb-setup"
if [[ ! -f "$SETUP_BIN" ]]; then
  SETUP_BIN="target/release/medoc-usb-setup"
fi
SERVER_BIN="target/release/medoc-server"

cp "$SETUP_BIN" "$OUT/MedocUsbSetup"
cp "$SERVER_BIN" "$OUT/medoc-usb/payloads/medoc-server"

if [[ -d "apps/practice-host/target/release/bundle" ]]; then
  find apps/practice-host/target/release/bundle -name '*.exe' -o -name '*.msi' -o -name '*.AppImage' 2>/dev/null | while read -r f; do
    cp "$f" "$OUT/medoc-usb/payloads/"
  done
fi

echo "USB kit ready at $OUT"
echo "Copy contents to USB root, then run: ./MedocUsbSetup wizard"
