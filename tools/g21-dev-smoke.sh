#!/usr/bin/env bash
# G21 live smoke — launches MeDoc with demo seed and prints checklist credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKLIST="$ROOT/docs/coordination/g21-live-smoke-checklist.md"

cat <<'EOF'

=== G21 Live Tauri Smoke ===

Demo logins (password for all: passwort123)
  REZEPTION  aya@praxis.de
  ARZT       ahmed@praxis.de

Rows to verify (mark in checklist):
  0    Run: bash tools/g21-verify-automated.sh  (must PASS)
  1–2  REZ  Sidebar → Posteingang, wait ≥6s poll
  3–4  ARZT create Aufgabe → REZ erledigen → ARZT notification bell
  5–6  REZ  Patientenakte clinical tabs blocked; Kundenleistungen OK
  7    ARZT Einstellungen → Betrieb → backup validate/restore
  8    ARZT Praxis-Tickets → Posteingang banner
  9    Serverless pairing (W8) — master accept replica; sync patient + praxis_ticket; revoke → 403

Checklist: docs/coordination/g21-live-smoke-checklist.md

Optional — print dev license token before launch:
  MEDOC_PRINT_LICENSE=1 bash tools/g21-dev-smoke.sh

EOF

if [[ "${MEDOC_PRINT_LICENSE:-}" == "1" ]]; then
  echo "=== Dev license (V2) ==="
  (
    cd "$ROOT"
    export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
    export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
    cargo test -p medoc-core --test gen_dev_license_once print_dev_licenses -- --ignored --nocapture 2>&1 \
      | sed -n '/--- V2 LICENSE/,/--- V1 LICENSE/p' | head -n -1
  ) || echo "(license helper failed — activate manually via Einstellungen → Lizenz)"
  echo
fi

exec "$ROOT/tools/dev-tauri.sh"
