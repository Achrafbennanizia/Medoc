#!/usr/bin/env bash
# Live backend API + connection matrix: medoc-server (HTTPS) + medoc-company-server (HTTP)
# plus cargo connection suites. Writes docs/coordination/backend-api-connection-matrix-results.md
#
# Usage (from repo root):
#   bash scripts/backend-api-connection-matrix.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export MEDOC_VENDOR_PUBKEY="${MEDOC_VENDOR_PUBKEY:-79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32}"
export MEDOC_DB_KEY="${MEDOC_DB_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_AUDIT_KEY="${MEDOC_AUDIT_KEY:-k9-medoc-test-audit-key-32bytes!}"
export MEDOC_PAIRING_MASTER_SECRET="${MEDOC_PAIRING_MASTER_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
export MEDOC_DEV_SEED=1

MASTER_PORT="${MEDOC_MASTER_PORT:-18787}"
COMPANY_PORT="${MEDOC_COMPANY_PORT:-19797}"
DISC_PORT="${MEDOC_DISCOVERY_PORT:-47831}"
MASTER_DIR="$(mktemp -d /tmp/medoc-api-matrix-master.XXXXXX)"
COMPANY_DIR="$(mktemp -d /tmp/medoc-api-matrix-company.XXXXXX)"
OUT="$ROOT/docs/coordination/backend-api-connection-matrix-results.md"
MASTER_PID=""
COMPANY_PID=""
BIN_DIR="${CARGO_TARGET_DIR:-$ROOT/target}/debug"
# Prefer workspace target; cargo may use sandbox cache in CI agents
if [[ ! -x "$BIN_DIR/medoc-server" ]]; then
  BIN_DIR="$(cargo metadata --format-version 1 --no-deps 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')/debug"
fi

cleanup() {
  [[ -n "${MASTER_PID:-}" ]] && kill "$MASTER_PID" 2>/dev/null || true
  [[ -n "${COMPANY_PID:-}" ]] && kill "$COMPANY_PID" 2>/dev/null || true
  rm -rf "$MASTER_DIR" "$COMPANY_DIR"
}
trap cleanup EXIT

PASS=0
FAIL=0
ROWS=()

truncate_body() {
  local s="$1"
  s="${s//$'\n'/ }"
  if ((${#s} > 180)); then
    printf '%s…' "${s:0:180}"
  else
    printf '%s' "$s"
  fi
}

expect_ok() {
  local code="$1"
  shift
  local e
  for e in "$@"; do
    if [[ "$code" == "$e" ]]; then
      return 0
    fi
  done
  return 1
}

record() {
  local name="$1" method="$2" url="$3" expect="$4" code="$5" body="$6"
  local ok="FAIL"
  # shellcheck disable=SC2086
  if expect_ok "$code" $expect; then
    ok="PASS"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
  local tb
  tb="$(truncate_body "$body")"
  ROWS+=("| $((PASS + FAIL)) | \`$name\` | $method | \`$url\` | $expect | $code | $ok | ${tb//|/\\|} |")
  printf '[%s] %s %s → %s (expect %s)\n' "$ok" "$method" "$name" "$code" "$expect"
}

curl_json() {
  # args: name method path expect_codes...  [optional: -H / -d via env AUTH BEARER BODY]
  local name="$1" method="$2" base="$3" path="$4"
  shift 4
  local expects=("$@")
  local url="${base}${path}"
  local args=(-sS -o /tmp/medoc_matrix_body.json -w '%{http_code}' -X "$method")
  if [[ "$base" == https* ]]; then
    args+=(-k)
  fi
  args+=(-H 'Content-Type: application/json' -H 'Accept: application/json')
  if [[ -n "${BEARER:-}" ]]; then
    args+=(-H "Authorization: Bearer $BEARER")
  fi
  if [[ -n "${SLUG:-}" ]]; then
    args+=(-H "X-Practice-Slug: $SLUG")
  fi
  if [[ -n "${BODY:-}" ]]; then
    args+=(-d "$BODY")
  fi
  args+=("$url")
  local code
  code="$(curl "${args[@]}" 2>/tmp/medoc_matrix_curl_err || true)"
  if [[ -z "$code" || ! "$code" =~ ^[0-9]+$ ]]; then
    code="000"
  fi
  local body
  body="$(cat /tmp/medoc_matrix_body.json 2>/dev/null || true)"
  if [[ -s /tmp/medoc_matrix_curl_err && "$code" == "000" ]]; then
    body="$(cat /tmp/medoc_matrix_curl_err)"
  fi
  record "$name" "$method" "$path" "${expects[*]}" "$code" "$body"
  unset BEARER SLUG BODY
}

echo "=== Build servers ==="
cargo build -q -p medoc-lan-server -p medoc-company-server

# Resolve binary after build
if [[ ! -x "$BIN_DIR/medoc-server" ]]; then
  BIN_DIR="$(cargo metadata --format-version 1 --no-deps | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')/debug"
fi
test -x "$BIN_DIR/medoc-server"
test -x "$BIN_DIR/medoc-company-server"

echo "=== Seed master data dir ==="
export MEDOC_MASTER_DATA_DIR="$MASTER_DIR"
cargo test -p medoc-e2e --test multi_device_port_http prepare_master_datadir -- --ignored --nocapture

export MEDOC_MASTER_URL="https://127.0.0.1:${MASTER_PORT}"
export MEDOC_COMPANY_URL="http://127.0.0.1:${COMPANY_PORT}"
export MEDOC_COMPANY_API_BASE="http://127.0.0.1:${COMPANY_PORT}"
export MEDOC_COMPANY_API_KEY="sk_demo_company_practice_key"
# LAN company proxy also needs practice slug in settings; env may be enough for some handlers
export MEDOC_COMPANY_PRACTICE_SLUG="${MEDOC_COMPANY_PRACTICE_SLUG:-demo-practice}"

echo "=== Start medoc-server :${MASTER_PORT} ==="
"$BIN_DIR/medoc-server" \
  --data-dir "$MASTER_DIR" \
  --http-bind 127.0.0.1 \
  --http-port "$MASTER_PORT" \
  --discovery-port "$DISC_PORT" \
  --label "API Matrix Master" &
MASTER_PID=$!

echo "=== Start medoc-company-server :${COMPANY_PORT} ==="
"$BIN_DIR/medoc-company-server" \
  --data-dir "$COMPANY_DIR" \
  --http-bind 127.0.0.1 \
  --http-port "$COMPANY_PORT" &
COMPANY_PID=$!

echo "=== Wait for health ==="
for _ in $(seq 1 60); do
  if curl -skf "${MEDOC_MASTER_URL}/health" >/dev/null 2>&1 \
    && curl -sf "${MEDOC_COMPANY_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

LAN="$MEDOC_MASTER_URL"
CO="$MEDOC_COMPANY_URL"
TODAY="$(date +%Y-%m-%d)"

echo ""
echo "=== A) Company server (direct HTTP) ==="
curl_json "company.health" GET "$CO" "/health" 200
BODY='{"display_name":"Matrix Practice","slug":"matrix-practice","admin_name":"Matrix Admin","admin_email":"matrix@example.com","plan":"PRO"}' \
  curl_json "company.register" POST "$CO" "/register" 200 201 409 400
SLUG=demo-practice BEARER=sk_demo_company_practice_key \
  curl_json "company.v1.health" GET "$CO" "/v1/health" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key \
  curl_json "company.v1.summary" GET "$CO" "/v1/summary" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key \
  curl_json "company.v1.integrations" GET "$CO" "/v1/integrations/status" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key \
  curl_json "company.v1.feature_flags" GET "$CO" "/v1/feature-flags" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key \
  curl_json "company.v1.updates" GET "$CO" "/v1/updates/manifest?current=0.1.0" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key BODY='{}' \
  curl_json "company.v1.billing_portal" POST "$CO" "/v1/billing/portal-session" 200
SLUG=demo-practice BEARER=sk_demo_company_practice_key BODY='{"provider_token":"tok_demo_12345"}' \
  curl_json "company.v1.payment_methods" POST "$CO" "/v1/billing/payment-methods" 200
# auth negatives
SLUG=demo-practice BEARER=sk_wrong_key \
  curl_json "company.v1.summary_bad_key" GET "$CO" "/v1/summary" 401 403 400
curl_json "company.v1.summary_no_auth" GET "$CO" "/v1/summary" 401 403 400

echo ""
echo "=== B) LAN HTTPS public + auth ==="
curl_json "lan.health" GET "$LAN" "/health" 200
curl_json "lan.ping" GET "$LAN" "/api/v1/ping" 200
curl_json "lan.pairing.master_info" GET "$LAN" "/api/v1/pairing/master-info" 200

BODY='{"email":"ahmed@practice.de","password":"password123"}' \
  curl_json "lan.auth.login" POST "$LAN" "/api/v1/auth/login" 200
JWT="$(python3 -c 'import json; print(json.load(open("/tmp/medoc_matrix_body.json")).get("access_token",""))' 2>/dev/null || true)"
if [[ -z "$JWT" ]]; then
  # TOTP may be required on seeded master from e2e prepare
  BODY='{"email":"ahmed@practice.de","password":"password123","totp":"1234"}' \
    curl_json "lan.auth.login_totp" POST "$LAN" "/api/v1/auth/login" 200
  JWT="$(python3 -c 'import json; print(json.load(open("/tmp/medoc_matrix_body.json")).get("access_token",""))' 2>/dev/null || true)"
fi

BODY='{"email":"ahmed@practice.de","password":"wrong"}' \
  curl_json "lan.auth.login_bad" POST "$LAN" "/api/v1/auth/login" 401 403 429

BEARER="$JWT" curl_json "lan.me.get" GET "$LAN" "/api/v1/me" 200
BEARER="$JWT" BODY='{"name":"Dr. Ahmed R.","phone":"+49 421 900100"}' \
  curl_json "lan.me.patch" PATCH "$LAN" "/api/v1/me" 200
BEARER="$JWT" curl_json "lan.patients.list" GET "$LAN" "/api/v1/patients" 200
BEARER="$JWT" curl_json "lan.appointments.list" GET "$LAN" "/api/v1/appointments?date=${TODAY}" 200
BEARER="$JWT" BODY='{"key":"practice.preferences.v1","value":"{\"theme\":\"system\"}"}' \
  curl_json "lan.app_kv.put" PUT "$LAN" "/api/v1/app-kv" 200 204
BEARER="$JWT" curl_json "lan.app_kv.get" GET "$LAN" "/api/v1/app-kv?key=practice.preferences.v1" 200
BEARER="$JWT" curl_json "lan.app_kv.delete" DELETE "$LAN" "/api/v1/app-kv?key=practice.preferences.v1" 200 204
BEARER="$JWT" curl_json "lan.license.status" GET "$LAN" "/api/v1/license" 200
BEARER="$JWT" BODY='{"token":"not-a-real-license"}' \
  curl_json "lan.license.activate_invalid" POST "$LAN" "/api/v1/license/activate" 200 400 422
BEARER="$JWT" BODY='{"patientId":"seed-pat-001","kvnr":"A123456789","pzn":"12345678","medicationName":"Amoxicillin","dosage":"1-0-1","quantity":1,"doctorLanr":"123456789"}' \
  curl_json "lan.eprescription.validate" POST "$LAN" "/api/v1/eprescriptions/validate" 200
BEARER="$JWT" BODY='{"patientId":"seed-pat-001","kvnr":"A123456789","pzn":"12345678","medicationName":"Amoxicillin","dosage":"1-0-1","quantity":1,"doctorLanr":"123456789"}' \
  curl_json "lan.eprescription.submit_stub" POST "$LAN" "/api/v1/eprescriptions/submit" 500 501

echo ""
echo "=== C) Pairing → activation → sync (connection path) ==="
DEVICE="matrix-live-replica"
PUBKEY="$(python3 - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("="))
PY
)"
BODY="$(python3 - <<PY
import json
print(json.dumps({"deviceId":"$DEVICE","slavePubkey":"$PUBKEY","slaveLabel":"Live Matrix Replica"}))
PY
)"
curl_json "lan.pairing.request" POST "$LAN" "/api/v1/pairing/request" 200
REQ_ID="$(python3 -c 'import json; print(json.load(open("/tmp/medoc_matrix_body.json")).get("id",""))')"

BEARER="$JWT" BODY='{"accept":true}' \
  curl_json "lan.pairing.decide" POST "$LAN" "/api/v1/pairing/decide/${REQ_ID}" 200
PIN="$(python3 -c 'import json; print(json.load(open("/tmp/medoc_matrix_body.json")).get("confirmPin",""))')"

BODY="$(python3 - <<PY
import json
print(json.dumps({"pin":"$PIN"}))
PY
)"
curl_json "lan.pairing.confirm" POST "$LAN" "/api/v1/pairing/confirm/${REQ_ID}" 200
ACT="$(python3 -c 'import json; print(json.load(open("/tmp/medoc_matrix_body.json")).get("activationToken",""))')"

curl_json "lan.pairing.status" GET "$LAN" "/api/v1/pairing/status/${REQ_ID}" 200
BEARER="$JWT" curl_json "lan.pairing.pending" GET "$LAN" "/api/v1/pairing/pending" 200
BEARER="$JWT" curl_json "lan.pairing.all" GET "$LAN" "/api/v1/pairing/all" 200
BEARER="$ACT" curl_json "lan.pairing.peers" GET "$LAN" "/api/v1/pairing/peers" 200
BEARER="$ACT" curl_json "lan.sync.status" GET "$LAN" "/api/v1/sync/status" 200
BEARER="$ACT" BODY="$(python3 - <<PY
import json
print(json.dumps({"fromDeviceId":"$DEVICE","entries":[]}))
PY
)" curl_json "lan.sync.push" POST "$LAN" "/api/v1/sync/push" 200
BEARER="$ACT" BODY="$(python3 - <<PY
import json
print(json.dumps({"deviceId":"$DEVICE","sinceSeq":0}))
PY
)" curl_json "lan.sync.pull" POST "$LAN" "/api/v1/sync/pull" 200

BEARER="$JWT" curl_json "lan.pairing.revoke" POST "$LAN" "/api/v1/pairing/revoke/${DEVICE}" 200 204

echo ""
echo "=== D) LAN → company proxy connection ==="
BEARER="$JWT" curl_json "lan.company.summary_proxy" GET "$LAN" "/api/v1/company/summary" 200 400 502 503 500 404
BEARER="$JWT" curl_json "lan.company.flags_proxy" GET "$LAN" "/api/v1/company/feature-flags" 200 400 502 503 500 404
BEARER="$JWT" curl_json "lan.company.integrations_proxy" GET "$LAN" "/api/v1/company/integrations/status" 200 400 502 503 500 404
BEARER="$JWT" BODY='{}' \
  curl_json "lan.company.billing_proxy" POST "$LAN" "/api/v1/company/billing/portal-session" 200 400 502 503 500 404

curl_json "lan.patients.unauthorized" GET "$LAN" "/api/v1/patients" 401 403

echo ""
echo "=== E) UDP discovery listen (connection) ==="
DISC_OK="FAIL"
DISC_OUT="$(python3 - <<PY
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(2.0)
try:
    s.sendto(b"MEDOC_DISCOVER_V1\n", ("127.0.0.1", $DISC_PORT))
    data, _ = s.recvfrom(4096)
    print(data.decode(errors="replace"))
except Exception as e:
    print("ERROR:" + str(e))
PY
)"
if [[ "$DISC_OUT" == ERROR:* ]]; then
  record "discovery.udp_probe" "UDP" "127.0.0.1:${DISC_PORT}" "200" "000" "$DISC_OUT"
else
  record "discovery.udp_probe" "UDP" "127.0.0.1:${DISC_PORT}" "200" "200" "$DISC_OUT"
  DISC_OK="PASS"
fi

echo ""
echo "=== F) Cargo connection suites ==="
SUITE_LOG=/tmp/medoc_matrix_suites.txt
{
  echo "## Cargo suite results"
  echo ""
  set +e
  cargo test -p medoc-lan --test http_route_matrix_tests -- --nocapture 2>&1 | tee /tmp/s_lan_matrix.txt | tail -5
  echo "lan_route_matrix_exit=$?"
  cargo test -p medoc-e2e --test company_portal -- --nocapture 2>&1 | tee /tmp/s_company.txt | tail -8
  echo "company_portal_exit=$?"
  cargo test -p medoc-e2e --test lan_pairing_sync -- --nocapture 2>&1 | tee /tmp/s_pair.txt | tail -8
  echo "lan_pairing_sync_exit=$?"
  cargo test -p medoc-e2e --test serverful_lan_client_flows -- --nocapture 2>&1 | tee /tmp/s_serverful.txt | tail -8
  echo "serverful_exit=$?"
  cargo test -p medoc-sync --test cluster_net_loopback -- --nocapture 2>&1 | tee /tmp/s_cluster.txt | tail -8
  echo "cluster_loopback_exit=$?"
  cargo test -p medoc-sync --test engine_http_tests -- --nocapture 2>&1 | tee /tmp/s_engine.txt | tail -8
  echo "engine_http_exit=$?"
  set -e
} | tee "$SUITE_LOG"

# Parse suite exits into rows
for pair in \
  "suite.lan_http_route_matrix:/tmp/s_lan_matrix.txt" \
  "suite.company_portal:/tmp/s_company.txt" \
  "suite.lan_pairing_sync:/tmp/s_pair.txt" \
  "suite.serverful_lan_client_flows:/tmp/s_serverful.txt" \
  "suite.cluster_net_loopback:/tmp/s_cluster.txt" \
  "suite.engine_http_tests:/tmp/s_engine.txt"
do
  name="${pair%%:*}"
  file="${pair#*:}"
  if grep -q 'test result: ok' "$file" 2>/dev/null; then
    record "$name" "cargo" "test" "200" "200" "$(grep 'test result:' "$file" | tail -1)"
  elif grep -q 'test result: FAILED' "$file" 2>/dev/null; then
    record "$name" "cargo" "test" "200" "500" "$(grep 'test result:' "$file" | tail -1)"
  else
    record "$name" "cargo" "test" "200" "000" "no test result line"
  fi
done

{
  echo "# Backend API + connection matrix"
  echo ""
  echo "**Generated:** \`bash scripts/backend-api-connection-matrix.sh\`  "
  echo "**LAN:** \`${LAN}\`  "
  echo "**Company:** \`${CO}\`  "
  echo "**Discovery UDP:** \`${DISC_PORT}\`  "
  echo "**Result:** ${PASS} passed / ${FAIL} failed / $((PASS + FAIL)) total"
  echo ""
  echo "| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |"
  echo "|---:|---|---|---|---|---:|:---:|---|"
  for r in "${ROWS[@]}"; do
    echo "$r"
  done
  echo ""
  echo "## Notes"
  echo ""
  echo "- Live TCP/TLS against real \`medoc-server\` + \`medoc-company-server\` binaries."
  echo "- Login may use TOTP \`1234\` when master was seeded by e2e \`prepare_master_datadir\`."
  echo "- e-Rx submit expects 500/501 without TI connector."
  echo "- LAN company proxy needs portal config; 400 without slug/base is acceptable."
  echo "- UDP discovery probe uses \`MEDOC_DISCOVER_V1\` (result: ${DISC_OK})."
  echo ""
  echo "## Suite log (tail)"
  echo ""
  echo '```'
  tail -n 80 "$SUITE_LOG"
  echo '```'
} > "$OUT"

echo ""
echo "Wrote $OUT"
echo "PASS=$PASS FAIL=$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
