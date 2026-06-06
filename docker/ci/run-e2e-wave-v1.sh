#!/usr/bin/env bash
# Wave V1 end-to-end validation inside Docker (Linux).
set -euo pipefail

cd /work

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"

echo "=== Wave V1 scoped unit/integration (baseline) ==="
cargo test -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server \
  -p medoc-company -p medoc-company-server --tests

echo ""
echo "=== medoc-e2e HTTP integration (in-process; excludes port-based multi-device) ==="
shopt -s nullglob
for f in crates/test/medoc-e2e/tests/*.rs; do
  base="$(basename "$f" .rs)"
  if [[ "$base" == "multi_device_port_http" ]]; then
    continue
  fi
  echo "--- medoc-e2e --test ${base} ---"
  cargo test -p medoc-e2e --test "$base"
done

echo ""
echo "=== Two-replica mesh + license gate (medoc-e2e) ==="
cargo test -p medoc-e2e --test two_replica_mesh

echo ""
echo "=== Headless medoc-server HTTPS smoke ==="
export MEDOC_SKIP_MASTER_LICENSE=1
DATA_DIR="$(mktemp -d /tmp/medoc-e2e-master.XXXXXX)"
cleanup() { rm -rf "$DATA_DIR"; kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

cargo build -q -p medoc-lan-server
./target/debug/medoc-server --data-dir "$DATA_DIR" --http-port 9876 &
SERVER_PID=$!

for i in $(seq 1 30); do
  if curl -skf "https://127.0.0.1:9876/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

HEALTH="$(curl -sk "https://127.0.0.1:9876/health")"
echo "$HEALTH" | grep -q '"status":"ok"' || { echo "health check failed: $HEALTH"; exit 1; }

PAIRING="$(curl -sk "https://127.0.0.1:9876/api/v1/pairing/master-info")"
echo "$PAIRING" | grep -q 'masterPubkey' || { echo "pairing master-info failed: $PAIRING"; exit 1; }

echo ""
echo "=== PASS (Wave V1 e2e Docker) ==="
