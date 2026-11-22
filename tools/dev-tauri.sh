#!/usr/bin/env bash
# Local MeDoc desktop dev — stable SQLCipher key + demo seed passwords.
#
# Runs from apps/practice-host (not practice-host-ui) because src-tauri is a
# symlink and Tauri CLI fails to match the Cargo manifest path from the UI dir.
#
# Frontend URL must be IPv4 loopback (127.0.0.1). Vite binding only to [::1]
# leaves the Tauri webview blank because WKWebView resolves localhost → IPv4.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/rust-env.sh
source "${ROOT}/scripts/rust-env.sh"
export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_DEV_SEED=1
# With MEDOC_DEV_SEED=1, migrations also load:
# - year volume (year_v4): 1000 patients, 10k clinical lines, ≥5k prescriptions,
#   ≥7k certificates, ≥€300k cash flow, calendar 3–17 appts/weekday, …
# - practice master (practice_v1): Settings profile, work hours, absences, products,
#   contracts, day-close, balance sheets, templates, suppliers, tickets, notifications
# Delete the matching app_kv keys and restart to regenerate. Skipped in cargo tests.
export RUST_MIN_STACK=8388608
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf}"
# Prefer IPv4 so Vite and Tauri agree (see vite.config.ts host default).
export TAURI_DEV_HOST="${TAURI_DEV_HOST:-127.0.0.1}"

VITE_URL="http://127.0.0.1:1420/"
VITE_PID=""
cleanup() {
  if [[ -n "$VITE_PID" ]]; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

vite_ipv4_ok() {
  # Must probe IPv4 explicitly — curl http://localhost may succeed via ::1
  # while the Tauri webview still cannot reach 127.0.0.1.
  curl -4 -sf -o /dev/null --connect-timeout 1 "$VITE_URL" 2>/dev/null
}

if ! vite_ipv4_ok; then
  echo "Starting Vite on ${VITE_URL} (IPv4) ..."
  (cd "$ROOT/apps/practice-host-ui" && npm run dev) &
  VITE_PID=$!
  ready=0
  for _ in $(seq 1 40); do
    if vite_ipv4_ok; then
      ready=1
      break
    fi
    # If Vite died, stop waiting.
    if ! kill -0 "$VITE_PID" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "error: Vite is not reachable on ${VITE_URL} (IPv4)." >&2
    echo "  A blank MeDoc window usually means Vite bound only to [::1]." >&2
    echo "  Check apps/practice-host-ui vite.config.ts host=127.0.0.1 and TAURI_DEV_HOST." >&2
    exit 1
  fi
  echo "Vite ready on ${VITE_URL}"
else
  echo "Reusing Vite already on ${VITE_URL}"
fi

cd "$ROOT/apps/practice-host"
exec "$ROOT/node_modules/.bin/tauri" dev --no-dev-server -c '{"build":{"beforeDevCommand":"","devUrl":"http://127.0.0.1:1420"}}'
