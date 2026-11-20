#!/usr/bin/env bash
# Safe Bridge v2 smoke: A/C match, KCV, forgotten-passphrase Bridge C, negatives.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KEYGEN="${ROOT}/installer/medoc-keygen/build/medoc-keygen"
VERIFY="${ROOT}/installer/medoc-keygen/build/medoc-keygen-verify"
REC="${CARGO_TARGET_DIR:-${ROOT}/target}/debug/medoc-recovery"
DIR="${TMPDIR:-/tmp}/medoc-safe-bridge-v2-$$"
PW_FILE="${DIR}/pw.txt"
WRAP_DIR="${DIR}/app-data"

cleanup() { rm -rf "${DIR}"; }
trap cleanup EXIT

mkdir -p "${DIR}" "${WRAP_DIR}"
printf 'correct horse battery staple\n' >"${PW_FILE}"
# New wrap passphrase after forgotten-passphrase recovery (policy: upper+lower+digit)
printf 'NewWrapPass1word\n' >"${DIR}/new-wrap.txt"

if [[ ! -x "${KEYGEN}" ]]; then
  cmake -S "${ROOT}/installer/medoc-keygen" -B "${ROOT}/installer/medoc-keygen/build"
  cmake --build "${ROOT}/installer/medoc-keygen/build" -j
fi
if [[ ! -x "${REC}" ]]; then
  (cd "${ROOT}" && cargo build -p medoc-recovery)
fi

"${KEYGEN}" --out "${DIR}/activation.json" --passphrase-file "${PW_FILE}"
"${VERIFY}" "${DIR}/activation.json" "correct horse battery staple"

# Bridge A
A_HEX="$("${REC}" recover --bridge a --manifest "${DIR}/activation.json" --passphrase-file "${PW_FILE}" 2>/dev/null | sed -n 's/^key_hex=//p')"
test -n "${A_HEX}"

# Bridge C without knowing passphrase (forgotten-passphrase path)
C_HEX="$("${REC}" recover --bridge c \
  --practice-share "${DIR}/practice-recovery.share.v2.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v2.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" 2>/dev/null | sed -n 's/^key_hex=//p')"
test "${A_HEX}" = "${C_HEX}"

# Write wrap from Bridge C for main app
"${REC}" recover --bridge c \
  --practice-share "${DIR}/practice-recovery.share.v2.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v2.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" \
  --write-wrap-dir "${WRAP_DIR}" \
  --wrap-passphrase-file "${DIR}/new-wrap.txt" >/dev/null

# Bridge B unlocks the wrap we just wrote
B_HEX="$("${REC}" recover --bridge b --app-dir "${WRAP_DIR}" --passphrase-file "${DIR}/new-wrap.txt" 2>/dev/null | sed -n 's/^key_hex=//p')"
test "${A_HEX}" = "${B_HEX}"

# Negatives: wrong practice share (flip a byte) → KCV fail
python3 - <<'PY' "${DIR}"
import json, sys, base64
d = sys.argv[1]
p = json.load(open(f"{d}/practice-recovery.share.v2.json"))
raw = bytearray(base64.b64decode(p["share"]))
raw[0] ^= 0xFF
p["share"] = base64.b64encode(bytes(raw)).decode()
json.dump(p, open(f"{d}/practice-bad.json", "w"))
PY

set +e
"${REC}" recover --bridge c \
  --practice-share "${DIR}/practice-bad.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v2.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" 2>"${DIR}/err.txt"
rc_kcv=$?
set -e
[[ "${rc_kcv}" -ne 0 ]]
grep -qi 'KCV' "${DIR}/err.txt"

# Vendor alone cannot open (no practice share path)
set +e
"${REC}" recover --bridge c \
  --practice-share "${DIR}/vendor-recovery.share.v2.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v2.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" 2>/dev/null
rc_bad=$?
set -e
[[ "${rc_bad}" -ne 0 ]]

echo "smoke-bridges-v2: PASS (A==C==B wrap, KCV rejects wrong share, vendor-alone fails)"
