#!/usr/bin/env bash
set -euo pipefail

failure_class="${1:-other}"

case "$failure_class" in
  advisory)
    if ! command -v cargo-audit >/dev/null 2>&1; then
      cargo install cargo-audit --locked
    fi
    cargo update --workspace || true
    npm audit fix --package-lock-only || true
    ;;
  typecheck)
    npm run lint -w medoc -- --fix || true
    ;;
  test)
    cargo fmt --all
    npm run lint -w medoc -- --fix || true
    ;;
  *)
    echo "No default fix strategy for class '$failure_class'."
    ;;
esac
