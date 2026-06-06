#!/usr/bin/env bash
# Local MeDoc desktop dev — stable SQLCipher key + demo seed passwords.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/practice-host-ui"
export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_DEV_SEED=1
exec npm run tauri dev
