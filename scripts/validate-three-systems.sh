#!/usr/bin/env bash
# Build each MeDoc deployable system in isolation (no full workspace test suite).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${MEDOC_VENDOR_PUBKEY:?Set MEDOC_VENDOR_PUBKEY}"
: "${MEDOC_DB_KEY:?Set MEDOC_DB_KEY}"
: "${MEDOC_AUDIT_KEY:?Set MEDOC_AUDIT_KEY}"

echo "==> Practice app (medoc)"
cargo build -p medoc --lib

echo "==> LAN server (medoc-lan-server)"
cargo build -p medoc-lan-server

echo "==> Company server (medoc-company-server)"
cargo build -p medoc-company-server

echo "All three systems built successfully."
