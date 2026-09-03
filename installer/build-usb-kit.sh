#!/usr/bin/env bash
# Package USB kit: medoc-usb-setup + practice NSIS + medoc-server payloads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"

OUT="${ROOT}/installer/dist/usb-kit"
mkdir -p "$OUT/medoc-usb/payloads"

TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}"
SETUP_BIN="$TARGET_DIR/release/medoc-usb-setup"
SERVER_BIN="$TARGET_DIR/release/medoc-server"
MEDOC_BIN="$TARGET_DIR/release/medoc"

if [[ "${REBUILD:-0}" == "1" ]] || [[ ! -f "$SETUP_BIN" ]] || [[ ! -f "$SERVER_BIN" ]]; then
  echo "Building medoc-usb-setup..."
  "$MEDOC_CARGO" build -p medoc-usb-setup --release

  echo "Building medoc-server..."
  "$MEDOC_CARGO" build -p medoc-lan-server --release
else
  echo "Using existing release binaries in $TARGET_DIR/release (set REBUILD=1 to force cargo build)."
fi

OS="$(uname -s)"
ARCH="$(uname -m)"
if [[ ! -f "$SETUP_BIN" ]]; then
  SETUP_BIN="installer/target/release/medoc-usb-setup"
fi
if [[ ! -f "$MEDOC_BIN" ]]; then
  MEDOC_BIN="apps/practice-host-ui/src-tauri/target/release/medoc"
fi
if [[ ! -f "$MEDOC_BIN" ]]; then
  MEDOC_BIN="apps/practice-host/target/release/medoc"
fi

cp "$SETUP_BIN" "$OUT/MedocUsbSetup"
cp "$SERVER_BIN" "$OUT/medoc-usb/payloads/medoc-server"

MEDOC_APP="$TARGET_DIR/release/bundle/macos/MeDoc.app"
if [[ -d "$MEDOC_APP" ]]; then
  echo "Bundling MeDoc.app (full desktop app with UI)..."
  rm -rf "$OUT/medoc-usb/payloads/MeDoc.app"
  cp -R "$MEDOC_APP" "$OUT/medoc-usb/payloads/"
elif [[ -f "$MEDOC_BIN" ]]; then
  echo "warning: MeDoc.app not found — kit will ship raw medoc binary (no UI bundle)."
  echo "         Prefer: source scripts/rust-env.sh && npm run build -w medoc && npm run tauri build -w medoc -- --bundles app"
  echo "         A cargo-built binary MUST use --features custom-protocol or the window stays blank."
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
echo "Double-click MedocUsbSetup (or run with no args) for the install window."
echo "CLI: ./MedocUsbSetup wizard   or   ./MedocUsbSetup install --password …"
