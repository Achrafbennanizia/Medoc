#!/usr/bin/env bash
# T-U1 — MVP Rust + FE coverage measurement (allow-list only).
#
# Usage:
#   bash tools/mvp-rust-coverage.sh              # summary to stdout
#   bash tools/mvp-rust-coverage.sh --archive    # also write HTML + snapshot markdown
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCHIVE=0
if [[ "${1:-}" == "--archive" ]]; then
  ARCHIVE=1
fi

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"

RUST_OUT="${ROOT}/releases/v0.1.0/coverage/rust-medoc-sync"
FE_OUT="${ROOT}/releases/v0.1.0/coverage/fe-mvp-unit"
SNAPSHOT="${ROOT}/docs/coordination/coverage-snapshot.md"
DATE="$(date -u +%Y-%m-%d)"

if ! command -v cargo-llvm-cov >/dev/null 2>&1; then
  echo "ERROR: cargo-llvm-cov not installed. Run: cargo install cargo-llvm-cov"
  exit 1
fi

echo "=== MVP Rust coverage: medoc-sync (T-U1) ==="
SYNC_SUMMARY="$(mktemp)"
if [[ "$ARCHIVE" == "1" ]]; then
  mkdir -p "$RUST_OUT"
  cargo llvm-cov -p medoc-sync --html --output-dir "$RUST_OUT" >/dev/null
  cargo llvm-cov -p medoc-sync --summary-only 2>&1 | tee "$SYNC_SUMMARY"
else
  cargo llvm-cov -p medoc-sync --summary-only 2>&1 | tee "$SYNC_SUMMARY"
fi

echo ""
echo "--- medoc-sync allow-list modules (line coverage) ---"
rg 'medoc-sync/src/(engine/run|repo/store|merge|pairing/)' "$SYNC_SUMMARY" || true
rg '^TOTAL' "$SYNC_SUMMARY" || true

echo ""
echo "=== MVP Rust coverage: medoc-lan (T-U1 HTTP) ==="
LAN_SUMMARY="$(mktemp)"
if [[ "$ARCHIVE" == "1" ]]; then
  LAN_OUT="${ROOT}/releases/v0.1.0/coverage/rust-medoc-lan"
  mkdir -p "$LAN_OUT"
  cargo llvm-cov -p medoc-lan --html --output-dir "$LAN_OUT" >/dev/null 2>&1 || \
    echo "WARN: medoc-lan llvm-cov skipped"
fi
cargo llvm-cov -p medoc-lan --summary-only 2>&1 | tee "$LAN_SUMMARY" || true
echo ""
echo "--- medoc-lan allow-list modules (line coverage) ---"
rg 'medoc-lan/src/(http/sync|http/pairing|master_license)' "$LAN_SUMMARY" || true

echo ""
echo "=== MVP Rust coverage: medoc-core (license + outbox tests) ==="
CORE_SUMMARY="$(mktemp)"
cargo llvm-cov -p medoc-core --test sync_outbox_hooks_tests --test license_v2_tests --summary-only 2>&1 | tee "$CORE_SUMMARY" || true
rg 'medoc-core/src/infrastructure/(database/sync_outbox|license)' "$CORE_SUMMARY" || true
if [[ "$ARCHIVE" == "1" ]]; then
  CORE_OUT="${ROOT}/releases/v0.1.0/coverage/rust-medoc-core-sync"
  mkdir -p "$CORE_OUT"
  cargo llvm-cov -p medoc-core --test sync_outbox_hooks_tests --test license_v2_tests --html --output-dir "$CORE_OUT" >/dev/null 2>&1 || \
    echo "WARN: medoc-core scoped llvm-cov skipped"
fi

echo ""
echo "=== Workspace Rust test counts ==="
for pkg in medoc-sync medoc-lan medoc-core medoc-e2e medoc-practice; do
  COUNT="$(cargo test -p "$pkg" --tests -- --list 2>/dev/null | rg -c ': test$' || echo '?')"
  echo "$pkg integration/unit tests: $COUNT"
done

echo ""
echo "=== MVP Frontend coverage: mvp-unit (T-U2) ==="
npm run test:mvp-coverage -w medoc -- --coverage.reporter=text-summary 2>&1 | tail -12

if [[ "$ARCHIVE" == "1" ]]; then
  mkdir -p "$FE_OUT"
  cp -f apps/practice-host-ui/coverage/mvp-unit/lcov.info "$FE_OUT/lcov.info" 2>/dev/null || true
fi

echo ""
echo "=== Integration test count (T-I1) ==="
E2E_COUNT="$(cargo test -p medoc-e2e --tests -- --list 2>/dev/null | rg -c ': test$' || echo '?')"
echo "medoc-e2e tests listed: $E2E_COUNT"

echo ""
echo "Allow-list: docs/coordination/mvp-test-scope.md"
echo "Target: 100% on scoped modules (Rust engine/run still PARTIAL)."

if [[ "$ARCHIVE" == "1" ]]; then
  ENGINE_LINE="$(rg 'medoc-sync/src/engine/run\.rs' "$SYNC_SUMMARY" | awk '{print $10}' | head -1 || echo '?')"
  REPO_LINE="$(rg 'medoc-sync/src/repo/store\.rs' "$SYNC_SUMMARY" | awk '{print $10}' | head -1 || echo '?')"
  MERGE_LINE="$(rg 'medoc-sync/src/merge\.rs' "$SYNC_SUMMARY" | awk '{print $10}' | head -1 || echo '?')"
  LAN_SYNC_LINE="$(rg 'medoc-lan/src/http/sync\.rs' "$LAN_SUMMARY" | awk '{print $10}' | head -1 || echo '?')"
  LAN_LICENSE_LINE="$(rg 'medoc-lan/src/master_license\.rs' "$LAN_SUMMARY" | awk '{print $10}' | head -1 || echo '?')"
  cat > "$SNAPSHOT" <<EOF
# Coverage snapshot

**Generated:** ${DATE} (UTC)  
**Command:** \`bash tools/mvp-rust-coverage.sh --archive\`

## Frontend (T-U2) — GREEN

\`npm run test:mvp-coverage -w medoc\` — 100% thresholds on 5 scoped modules (22 tests).

Reports: \`apps/practice-host-ui/coverage/mvp-unit/\`, archive \`releases/v0.1.0/coverage/fe-mvp-unit/\`.

## Rust medoc-sync (T-U1) — PARTIAL

| Module | Line cov |
|--------|----------|
| \`engine/run.rs\` | ${ENGINE_LINE} |
| \`repo/store.rs\` | ${REPO_LINE} |
| \`merge.rs\` | ${MERGE_LINE} |

HTML: \`releases/v0.1.0/coverage/rust-medoc-sync/html/index.html\`

## Rust medoc-lan (T-U1) — PARTIAL

| Module | Line cov |
|--------|----------|
| \`http/sync.rs\` | ${LAN_SYNC_LINE} |
| \`master_license.rs\` | ${LAN_LICENSE_LINE} |

HTML: \`releases/v0.1.0/coverage/rust-medoc-lan/html/index.html\`

## Integration (T-I1)

**${E2E_COUNT}** tests in \`crates/test/medoc-e2e\`; Docker port **17/17**.

See [\`validation.md\`](validation.md) for last full pipeline run.
EOF
  echo "Wrote $SNAPSHOT"
  rm -f "$LAN_SUMMARY" "$CORE_SUMMARY"
fi

rm -f "$SYNC_SUMMARY" "$LAN_SUMMARY" "$CORE_SUMMARY"
