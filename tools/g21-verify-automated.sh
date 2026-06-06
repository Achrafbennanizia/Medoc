#!/usr/bin/env bash
# Run all automated G21 / collaboration proxies before the live Tauri checklist (G21b).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== G21 automated proxy suite ==="

npm test -- --run \
  packages/shared/src/lib/collaboration-g21.test.ts \
  packages/shared/src/lib/nav-sections.test.ts \
  packages/shared/src/lib/quittung-export-flow.test.ts \
  apps/practice-host-ui/src/g21-routing.smoke.test.tsx \
  apps/practice-host-ui/src/views/pages/posteingang.smoke.test.tsx \
  apps/practice-host-ui/src/views/pages/praxis-tickets.smoke.test.tsx \
  apps/practice-host-ui/src/views/pages/ops.smoke.test.tsx \
  apps/practice-host-ui/src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx \
  packages/app/practice-host/src/pages/patient-detail/patient-detail-akte-subnav.smoke.test.tsx \
  apps/practice-host-ui/src/views/components/notifications-popover.smoke.test.tsx

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
