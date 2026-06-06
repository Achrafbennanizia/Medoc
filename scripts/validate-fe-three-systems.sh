#!/usr/bin/env bash
# Verify frontend tier isolation: server packages must not depend on Tauri.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

check_no_tauri() {
  local dir="$1"
  local label="$2"
  if rg -q '@tauri-apps/' "$dir" 2>/dev/null; then
    echo "FAIL: $label contains @tauri-apps imports:"
    rg '@tauri-apps/' "$dir" || true
    fail=1
  else
    echo "OK: $label has no @tauri-apps imports"
  fi
}

check_no_tauri "packages/server/lan/src" "@medoc/system-lan"
check_no_tauri "packages/server/company/src" "@medoc/system-company"
check_no_tauri "packages/shared/src" "@medoc/shared"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "Frontend tier isolation checks passed."
