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
TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}"
SETUP_BIN="$TARGET_DIR/release/medoc-usb-setup"
if [[ ! -f "$SETUP_BIN" ]]; then
  SETUP_BIN="installer/target/release/medoc-usb-setup"
fi
SERVER_BIN="$TARGET_DIR/release/medoc-server"
MEDOC_BIN="$TARGET_DIR/release/medoc"
if [[ ! -f "$MEDOC_BIN" ]]; then
  MEDOC_BIN="apps/practice-host-ui/src-tauri/target/release/medoc"
fi
if [[ ! -f "$MEDOC_BIN" ]]; then
  MEDOC_BIN="apps/practice-host/target/release/medoc"
fi

cp "$SETUP_BIN" "$OUT/MedocUsbSetup"
cp "$SERVER_BIN" "$OUT/medoc-usb/payloads/medoc-server"
if [[ -f "$MEDOC_BIN" ]]; then
  cp "$MEDOC_BIN" "$OUT/medoc-usb/payloads/medoc"
fi

if [[ -d "$TARGET_DIR/release/bundle" ]]; then
  find "$TARGET_DIR/release/bundle" -name '*.exe' -o -name '*.msi' -o -name '*.AppImage' -o -name '*.app' -type d 2>/dev/null | while read -r f; do
    cp -R "$f" "$OUT/medoc-usb/payloads/"
  done
fi
if [[ -d "apps/practice-host/target/release/bundle" ]]; then
  find apps/practice-host/target/release/bundle -name '*.exe' -o -name '*.msi' -o -name '*.AppImage' -o -name '*.app' -type d 2>/dev/null | while read -r f; do
    cp -R "$f" "$OUT/medoc-usb/payloads/"
  done
fi
if [[ -d "apps/practice-host-ui/src-tauri/target/release/bundle" ]]; then
  find apps/practice-host-ui/src-tauri/target/release/bundle -name '*.exe' -o -name '*.msi' -o -name '*.AppImage' -o -name '*.app' -type d 2>/dev/null | while read -r f; do
    cp -R "$f" "$OUT/medoc-usb/payloads/"
  done
fi

echo "USB kit ready at $OUT"
echo "Copy contents to USB root, then run: ./MedocUsbSetup wizard"
