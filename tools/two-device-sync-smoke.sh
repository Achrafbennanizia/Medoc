#!/usr/bin/env bash
# Two-device serverless sync smoke — headless proxy for T-S2 / W8.
#
# Usage (host A = master):
#   export MEDOC_MASTER_URL=https://127.0.0.1:8787
#   export MEDOC_MASTER_DATA_DIR=/tmp/medoc-master-smoke
#   bash tools/two-device-sync-smoke.sh
#
# Requires: medoc-server running on MEDOC_MASTER_URL, license activated, pairing enabled.
# Live Tauri sign-off: docs/coordination/g21-live-smoke-checklist.md (serverless rows).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MASTER_URL="${MEDOC_MASTER_URL:-https://127.0.0.1:8787}"
MASTER_DATA_DIR="${MEDOC_MASTER_DATA_DIR:-/tmp/medoc-two-device-master}"

echo "== Two-device sync smoke (W8 / T-S2) =="
echo "Master URL: $MASTER_URL"
echo "Tier-1 tables: patient, termin, rezept, praxis_ticket, praxis_aufgabe (+ 10 more)"

if [[ -x "$ROOT/scripts/validate-docker-multi-device.sh" ]]; then
  echo "Running Docker port e2e proxy (16+ tests incl. rezept + praxis_ticket)..."
  bash "$ROOT/scripts/validate-docker-multi-device.sh"
else
  echo "WARN: validate-docker-multi-device.sh not found — running in-process e2e subset"
  export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
  cargo test -p medoc-e2e --test activation_token_rbac --test three_replica_conflict_matrix --test mesh_peer_delivery
fi

echo ""
echo "Manual sign-off (live Tauri — second physical host or VM):"
echo "  1. Master: medoc-server + license + accept pairing in Einstellungen"
echo "  2. Replica: serverless_peer REPLICA → pairing scan or paste master URL"
echo "  3. Create patient + praxis_ticket on replica → verify on master after sync"
echo "  4. Push rezept on replica → verify on master"
echo "  5. Revoke replica → push must return 403"
echo ""
echo "API catalog: docs/coordination/multi-device-api-catalog.md"
echo "G21 checklist: docs/coordination/g21-live-smoke-checklist.md"
