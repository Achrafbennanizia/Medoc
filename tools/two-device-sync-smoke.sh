#!/usr/bin/env bash
# Two-device serverless sync smoke — headless proxy for T-S2 / W8.
#
# Usage (automated — default):
#   bash tools/two-device-sync-smoke.sh
#
# Live Tauri sign-off (second host): docs/coordination/g21-live-smoke-checklist.md
#
# Env:
#   AUTO_ONLY=1     — exit after automated checks (default)
#   AUTO_ONLY=0     — print manual live steps after automated proxy

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

AUTO_ONLY="${AUTO_ONLY:-1}"

echo "== Two-device sync smoke (W8 / T-S2) =="
echo "Tier-1 tables: patient, termin, rezept, praxis_ticket, praxis_aufgabe (+ 10 more)"

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"

if [[ -x "$ROOT/scripts/validate-docker-multi-device.sh" ]]; then
  echo "Running Docker port e2e proxy (17 tests incl. rezept + praxis_ticket + mesh)..."
  bash "$ROOT/scripts/validate-docker-multi-device.sh"
else
  echo "WARN: validate-docker-multi-device.sh not found — running in-process e2e subset"
  cargo test -p medoc-e2e --test activation_token_rbac --test three_replica_conflict_matrix --test mesh_peer_delivery
fi

echo ""
echo "=== PASS (automated two-device proxy) ==="

if [[ "$AUTO_ONLY" == "1" ]]; then
  exit 0
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
