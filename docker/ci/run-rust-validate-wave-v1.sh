#!/usr/bin/env bash
# Lightweight Linux validation for Wave V1 crates (no full Tauri link).
# Use when disk is tight or for faster CI smoke on pairing/sync/license.
set -euo pipefail

cd /work/app

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"

PACKAGES=(medoc-core medoc-sync medoc-lan medoc-lan-server medoc-company medoc-company-server)

echo "=== cargo fmt --check ==="
cargo fmt --all -- --check

echo "=== cargo clippy (Wave V1 crates, no Tauri) ==="
cargo clippy -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server \
  -p medoc-company -p medoc-company-server --all-targets -- -D warnings

echo "=== cargo test (Wave V1 + headless servers) ==="
cargo test -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server \
  -p medoc-company -p medoc-company-server --tests

echo "=== targeted Wave V1 integration tests ==="
cargo test -p medoc-core --test license_v2_tests
cargo test -p medoc-core --test sync_outbox_hooks_tests
cargo test -p medoc-sync --lib
cargo test -p medoc-e2e --tests

# Optional coverage pass. Skipped by default to keep CI under the
# 5-minute budget; enable per-run with MEDOC_COVERAGE=1.
if [[ "${MEDOC_COVERAGE:-0}" == "1" ]]; then
  if command -v cargo-llvm-cov >/dev/null 2>&1; then
    echo "=== cargo llvm-cov (Wave V1 crates + e2e) ==="
    mkdir -p /work/app/target/coverage
    cargo llvm-cov clean --workspace
    cargo llvm-cov --no-report \
      -p medoc-sync -p medoc-lan -p medoc-lan-server \
      -p medoc-company -p medoc-company-server \
      --tests
    cargo llvm-cov --no-report \
      -p medoc-core --test license_v2_tests
    cargo llvm-cov --no-report \
      -p medoc-core --test sync_outbox_hooks_tests
    cargo llvm-cov --no-report \
      -p medoc-e2e --tests
    cargo llvm-cov report --summary-only --ignore-filename-regex 'tests?/' \
      | tee /work/app/target/coverage/summary.txt
    cargo llvm-cov report --lcov --output-path /work/app/target/coverage/lcov.info
  else
    echo "cargo-llvm-cov not installed; skipping coverage."
  fi
fi

echo "=== PASS (Wave V1 scoped) ==="
