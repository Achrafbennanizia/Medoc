#!/usr/bin/env bash
# Install/repair repo-local Rust toolchain under .dev-home/ (for builds without system cargo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export CARGO_HOME="${CARGO_HOME:-${ROOT}/.dev-home/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-${ROOT}/.dev-home/.rustup}"

if ! command -v rustup >/dev/null 2>&1; then
  echo "error: rustup not found. Install via: brew install rustup-init && rustup-init" >&2
  exit 1
fi

echo "Installing stable toolchain into ${RUSTUP_HOME} ..."
rustup toolchain install stable --profile minimal
rustup component add cargo rustc rust-std rustfmt
rustup default stable

# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"
echo "cargo: $($MEDOC_CARGO --version)"
echo "rustc: $(rustc --version)"
