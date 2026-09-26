#!/usr/bin/env bash

set -euo pipefail

detect_pm() {
  if [[ -f pnpm-lock.yaml ]]; then
    echo "pnpm"
  elif [[ -f yarn.lock ]]; then
    echo "yarn"
  else
    echo "npm"
  fi
}

run_medoc_script() {
  local pm="$1"
  local script_name="$2"
  case "$pm" in
    pnpm) pnpm --filter medoc run "$script_name" ;;
    yarn) yarn workspace medoc "$script_name" ;;
    npm) npm run "$script_name" -w medoc ;;
    *)
      echo "Unsupported package manager: $pm" >&2
      return 1
      ;;
  esac
}

install_deps() {
  local pm="$1"
  case "$pm" in
    pnpm) pnpm install --frozen-lockfile ;;
    yarn) yarn install --immutable ;;
    npm) npm ci ;;
    *)
      echo "Unsupported package manager: $pm" >&2
      return 1
      ;;
  esac
}

PM="$(detect_pm)"

corepack enable
install_deps "$PM"

cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

if ! command -v cargo-audit >/dev/null 2>&1; then
  cargo install cargo-audit --locked
fi
cargo audit

run_medoc_script "$PM" lint
run_medoc_script "$PM" typecheck
run_medoc_script "$PM" test
run_medoc_script "$PM" build
run_medoc_script "$PM" test:a11y
