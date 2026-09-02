#!/usr/bin/env bash
# Build MeDoc desktop installers for the current platform (no keygen bundling).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"

npm ci
npm run build -w medoc
node scripts/configure-tauri-updater.mjs
# Local USB/dev builds have no updater private key. Skip updater .tar.gz signing
# unless TAURI_SIGNING_PRIVATE_KEY is set (CI release).

OS="$(uname -s)"
case "$OS" in
  Linux)
    npm run tauri build -w medoc -- --bundles deb,rpm,appimage
    ;;
  Darwin)
    npm run tauri build -w medoc -- --bundles dmg,app
    ;;
  MINGW*|MSYS*|CYGWIN*)
    npm run tauri build -w medoc -- --bundles nsis,msi
    ;;
  *)
    echo "Unsupported OS for installer build: $OS" >&2
    exit 1
    ;;
esac

echo "Installers under apps/practice-host/target/release/bundle/"
