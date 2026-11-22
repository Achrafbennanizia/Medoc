#!/usr/bin/env bash
# Build MeDoc desktop installers for the current platform (no keygen bundling).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"

npm ci
OS="$(uname -s)"
if [[ "$OS" == MINGW* || "$OS" == MSYS* || "$OS" == CYGWIN* ]]; then
  powershell.exe -NoProfile -File "${ROOT}/scripts/ci-windows-unwrap-workspace-node-modules.ps1"
fi
npm run build -w medoc
node scripts/configure-tauri-updater.mjs
# Local USB/dev builds have no updater private key. Skip updater .tar.gz signing
# unless TAURI_SIGNING_PRIVATE_KEY is set (CI release).

case "$OS" in
  Linux)
    npm run tauri -w medoc-tauri-host -- build --bundles deb,rpm,appimage
    ;;
  Darwin)
    npm run tauri -w medoc-tauri-host -- build --bundles dmg,app
    ;;
  MINGW*|MSYS*|CYGWIN*)
    npm run tauri -w medoc-tauri-host -- build --bundles nsis,msi
    ;;
  *)
    echo "Unsupported OS for installer build: $OS" >&2
    exit 1
    ;;
esac

if [[ "$OS" == Darwin ]]; then
  SRC="${ROOT}/apps/practice-host/target/release/bundle/macos/MeDoc.app"
  DST="${ROOT}/apps/practice-host/target/release/bundle/macos/Medoc_replica.app"
  if [[ -d "$SRC" ]]; then
    rm -rf "$DST"
    ditto "$SRC" "$DST"
    PLIST="$DST/Contents/Info.plist"
    for key in CFBundleName CFBundleDisplayName; do
      /usr/libexec/PlistBuddy -c "Set :${key} Medoc_replica" "$PLIST" \
        || /usr/libexec/PlistBuddy -c "Add :${key} string Medoc_replica" "$PLIST"
    done
    codesign --force --deep --sign - "$DST"
    echo "Replica bundle: $DST"
  fi
fi

echo "Installers under apps/practice-host/target/release/bundle/"
