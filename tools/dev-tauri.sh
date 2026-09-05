#!/usr/bin/env bash
# Local MeDoc desktop dev — stable SQLCipher key + demo seed passwords.
#
# Runs from apps/practice-host (not practice-host-ui) because src-tauri is a
# symlink and Tauri CLI fails to match the Cargo manifest path from the UI dir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"
export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_DEV_SEED=1
# With MEDOC_DEV_SEED=1, migrations also load:
# - year volume (year_v3): 1000 patients, 10k clinical lines, ≥5k prescriptions,
#   ≥7k certificates, ≥€300k cash flow, …
# - practice master (practice_v1): Settings profile, work hours, absences, products,
#   contracts, day-close, balance sheets, templates, suppliers, tickets, notifications
# Delete the matching app_kv keys and restart to regenerate. Skipped in cargo tests.
export RUST_MIN_STACK=8388608
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf}"

VITE_PID=""
cleanup() {
  if [[ -n "$VITE_PID" ]]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl -sf -o /dev/null http://localhost:1420/ 2>/dev/null; then
  echo "Starting Vite on http://localhost:1420/ ..."
  (cd "$ROOT/apps/practice-host-ui" && npm run dev) &
  VITE_PID=$!
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null http://localhost:1420/ 2>/dev/null && break
    sleep 0.5
  done
fi

cd "$ROOT/apps/practice-host"
exec "$ROOT/node_modules/.bin/tauri" dev --no-dev-server -c '{"build":{"beforeDevCommand":""}}'
