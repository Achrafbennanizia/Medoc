#!/usr/bin/env bash
set -euo pipefail

cd /work

echo "=== cargo fmt --check ==="
cargo fmt --all -- --check

echo "=== cargo check --workspace --all-targets ==="
cargo check --workspace --all-targets

echo "=== cargo clippy -D warnings ==="
cargo clippy --workspace --all-targets -- -D warnings

echo "=== cargo test --workspace --tests (in-process e2e only) ==="
cargo test --workspace --tests --exclude medoc-e2e
shopt -s nullglob
for f in crates/test/medoc-e2e/tests/*.rs; do
  base="$(basename "$f" .rs)"
  if [[ "$base" == "multi_device_port_http" ]]; then
    continue
  fi
  echo "--- medoc-e2e --test ${base} ---"
  cargo test -p medoc-e2e --test "$base"
done

echo "=== targeted Wave V1 tests ==="
cargo test -p medoc-core --test license_v2_tests
cargo test -p medoc-core --test sync_outbox_hooks_tests
cargo test -p medoc-sync --lib

echo "=== PASS ==="
