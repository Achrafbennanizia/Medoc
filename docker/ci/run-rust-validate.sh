#!/usr/bin/env bash
set -euo pipefail

cd /work/app

echo "=== cargo fmt --check ==="
cargo fmt --all -- --check

echo "=== cargo check --workspace --all-targets ==="
cargo check --workspace --all-targets

echo "=== cargo clippy -D warnings ==="
cargo clippy --workspace --all-targets -- -D warnings

echo "=== cargo test --workspace --tests ==="
cargo test --workspace --tests

echo "=== targeted Wave V1 tests ==="
cargo test -p medoc-core --test license_v2_tests
cargo test -p medoc-core --test sync_outbox_hooks_tests
cargo test -p medoc-sync --lib

echo "=== PASS ==="
