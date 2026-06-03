#!/usr/bin/env bash
# Run all automated G21 / collaboration proxies before the live Tauri checklist (G21b).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"

echo "=== G21 automated proxy suite ==="

npm test -- --run \
  src/lib/collaboration-g21.test.ts \
  src/lib/nav-sections.test.ts \
  src/lib/quittung-export-flow.test.ts \
  src/g21-routing.smoke.test.tsx \
  src/views/pages/posteingang.smoke.test.tsx \
  src/views/pages/praxis-tickets.smoke.test.tsx \
  src/views/pages/ops.smoke.test.tsx \
  src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx \
  src/systems/practice-host/pages/patient-detail/patient-detail-akte-subnav.smoke.test.tsx \
  src/views/components/notifications-popover.smoke.test.tsx

echo ""
echo "=== Rust G21 backend flow ==="
export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
cargo test --test praxis_aufgabe_tests g21_arzt_to_rez_flow -- --nocapture

echo ""
echo "=== GAP-01 redaction (Rust) ==="
cargo test -p medoc-core rezeption_redact::tests -- --nocapture

echo ""
echo "PASS — proceed with live checklist: docs/coordination/g21-live-smoke-checklist.md"
echo "Launch: bash tools/g21-dev-smoke.sh"
