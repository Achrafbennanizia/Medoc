#!/usr/bin/env bash
set -euo pipefail

failure_kind="${1:-unknown}"
pm="${2:-npm}"

run_medoc_script() {
  local script_name="$1"
  case "$pm" in
    pnpm) pnpm --filter medoc run "$script_name" ;;
    yarn) yarn workspace medoc run "$script_name" ;;
    npm) npm run "$script_name" -w medoc ;;
    *) echo "Unsupported package manager: $pm" >&2; exit 1 ;;
  esac
}

run_js_advisory_check() {
  case "$pm" in
    pnpm) pnpm audit --prod ;;
    yarn) yarn audit --groups dependencies ;;
    npm) npm audit --omit=dev ;;
    *) echo "Unsupported package manager: $pm" >&2; exit 1 ;;
  esac
}

case "$failure_kind" in
  test_failure)
    cargo test --workspace
    run_medoc_script test
    ;;
  security_advisory)
    if ! command -v cargo-audit >/dev/null 2>&1; then
      cargo install cargo-audit --locked
    fi
    cargo audit
    run_js_advisory_check
    ;;
  type_error)
    run_medoc_script typecheck
    ;;
  unknown)
    cargo test --workspace
    run_medoc_script lint
    run_medoc_script typecheck
    run_medoc_script test
    run_medoc_script build
    ;;
  *)
    echo "Unknown failure kind: $failure_kind" >&2
    exit 1
    ;;
esac
