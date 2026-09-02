#!/usr/bin/env bash
# Source from build scripts: `. "$(dirname "$0")/../scripts/rust-env.sh"` or via ROOT.
# Ensures repo-local Rust (`.dev-home/`) is on PATH for cargo/tauri builds.
if [[ -z "${ROOT:-}" ]]; then
  _medoc_src="${BASH_SOURCE[0]:-$0}"
  ROOT="$(cd "$(dirname "$_medoc_src")/.." && pwd)"
fi

export CARGO_HOME="${CARGO_HOME:-${ROOT}/.dev-home/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-${ROOT}/.dev-home/.rustup}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${ROOT}/target}"

resolve_cargo() {
  if command -v cargo >/dev/null 2>&1; then
    command -v cargo
    return 0
  fi
  if [[ -x "${CARGO_HOME}/bin/cargo" ]]; then
    echo "${CARGO_HOME}/bin/cargo"
    return 0
  fi
  local from_rustup=""
  from_rustup="$(RUSTUP_HOME="${RUSTUP_HOME}" CARGO_HOME="${CARGO_HOME}" rustup which cargo 2>/dev/null || true)"
  if [[ -n "$from_rustup" && -x "$from_rustup" ]]; then
    echo "$from_rustup"
    return 0
  fi
  local host_triple=""
  host_triple="$(RUSTUP_HOME="${RUSTUP_HOME}" CARGO_HOME="${CARGO_HOME}" rustup show active-toolchain 2>/dev/null | awk '{print $1}' | cut -d- -f2-)"
  if [[ -n "$host_triple" && -x "${RUSTUP_HOME}/toolchains/stable-${host_triple}/bin/cargo" ]]; then
    echo "${RUSTUP_HOME}/toolchains/stable-${host_triple}/bin/cargo"
    return 0
  fi
  echo "error: cargo not found. Run: bash scripts/bootstrap-dev-rust.sh" >&2
  return 1
}

MEDOC_CARGO="$(resolve_cargo)"
export PATH="$(dirname "$MEDOC_CARGO"):${PATH}"
