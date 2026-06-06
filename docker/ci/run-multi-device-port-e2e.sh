#!/usr/bin/env bash
# Multi-device port-based backend e2e — real medoc-server + medoc-company-server over HTTPS/HTTP.
#
# Simulates serverless topology: one licensed master (LAN HTTPS) + two replica devices
# (HTTP clients with activation tokens) + company portal (HTTP).
#
# Usage (inside Docker or host with Rust toolchain):
#   bash docker/ci/run-multi-device-port-e2e.sh
set -euo pipefail

cd /work

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_DEV_SEED=1
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"

MASTER_PORT="${MEDOC_MASTER_PORT:-8787}"
COMPANY_PORT="${MEDOC_COMPANY_PORT:-9797}"
MASTER_DIR="$(mktemp -d /tmp/medoc-port-master.XXXXXX)"
COMPANY_DIR="$(mktemp -d /tmp/medoc-port-company.XXXXXX)"
MASTER_PID=""
COMPANY_PID=""

cleanup() {
  [[ -n "$MASTER_PID" ]] && kill "$MASTER_PID" 2>/dev/null || true
  [[ -n "$COMPANY_PID" ]] && kill "$COMPANY_PID" 2>/dev/null || true
  rm -rf "$MASTER_DIR" "$COMPANY_DIR"
}
trap cleanup EXIT

echo "=== Build headless server binaries ==="
cargo build -q -p medoc-lan-server -p medoc-company-server

echo ""
echo "=== Seed master data directory (license + demo users + TOTP) ==="
export MEDOC_MASTER_DATA_DIR="$MASTER_DIR"
cargo test -p medoc-e2e --test multi_device_port_http prepare_master_datadir -- --ignored --nocapture

export MEDOC_MASTER_URL="https://127.0.0.1:${MASTER_PORT}"
export MEDOC_COMPANY_URL="http://127.0.0.1:${COMPANY_PORT}"
export MEDOC_COMPANY_API_BASE="http://127.0.0.1:${COMPANY_PORT}"
export MEDOC_COMPANY_API_KEY="sk_demo_company_practice_key"
export MEDOC_MASTER_DATA_DIR="$MASTER_DIR"
export MEDOC_REPLICA_A_PORT=8788
export MEDOC_REPLICA_B_PORT=8789

echo ""
echo "=== Start medoc-server (master LAN HTTPS :${MASTER_PORT}) ==="
./target/debug/medoc-server \
  --data-dir "$MASTER_DIR" \
  --http-port "$MASTER_PORT" \
  --label "Docker Port-E2E Master" &
MASTER_PID=$!

echo "=== Start medoc-company-server (HTTP :${COMPANY_PORT}) ==="
./target/debug/medoc-company-server \
  --data-dir "$COMPANY_DIR" \
  --http-port "$COMPANY_PORT" &
COMPANY_PID=$!

echo ""
echo "=== Wait for services ==="
for i in $(seq 1 40); do
  if curl -skf "${MEDOC_MASTER_URL}/health" >/dev/null 2>&1 \
    && curl -sf "${MEDOC_COMPANY_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -sk "${MEDOC_MASTER_URL}/health" | grep -q '"status":"ok"' || { echo "master health failed"; exit 1; }
curl -s "${MEDOC_COMPANY_URL}/health" | grep -q '"service":"medoc-company-server"' || { echo "company health failed"; exit 1; }

echo ""
echo "=== Port-based multi-device HTTP integration (medoc-e2e) ==="
cargo test -p medoc-e2e --test multi_device_port_http -- --test-threads=1

echo ""
echo "=== PASS (multi-device port e2e) ==="
