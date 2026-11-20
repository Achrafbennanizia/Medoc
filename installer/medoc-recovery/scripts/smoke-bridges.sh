#!/usr/bin/env bash
# Smoke: Bridge A/C recover match; vendor share alone cannot recover; wrong passphrase fails.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KEYGEN="${ROOT}/installer/medoc-keygen/build/medoc-keygen"
VERIFY="${ROOT}/installer/medoc-keygen/build/medoc-keygen-verify"
REC="${ROOT}/installer/medoc-recovery/build/medoc-recovery"
DIR="${TMPDIR:-/tmp}/medoc-safe-bridge-smoke-$$"
PW_FILE="${DIR}/pw.txt"

cleanup() { rm -rf "${DIR}"; }
trap cleanup EXIT

mkdir -p "${DIR}"
printf 'correct horse battery staple\n' >"${PW_FILE}"

if [[ ! -x "${KEYGEN}" ]]; then
  cmake -S "${ROOT}/installer/medoc-keygen" -B "${ROOT}/installer/medoc-keygen/build"
  cmake --build "${ROOT}/installer/medoc-keygen/build" -j
fi
if [[ ! -x "${REC}" ]]; then
  cmake -S "${ROOT}/installer/medoc-recovery" -B "${ROOT}/installer/medoc-recovery/build"
  cmake --build "${ROOT}/installer/medoc-recovery/build" -j
fi

"${KEYGEN}" --out "${DIR}/activation.json" --passphrase-file "${PW_FILE}"
"${VERIFY}" "${DIR}/activation.json" "correct horse battery staple"

"${REC}" recover --bridge a --manifest "${DIR}/activation.json" --passphrase-file "${PW_FILE}" \
  --then export-key --then-out "${DIR}/from-a.key"
"${REC}" recover --bridge c \
  --practice-share "${DIR}/practice-recovery.share.v1.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v1.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" \
  --passphrase-file "${PW_FILE}" \
  --then export-key --then-out "${DIR}/from-c.key"

cmp "${DIR}/from-a.key" "${DIR}/from-c.key"

set +e
printf 'wrong passphrase!!\n' >"${DIR}/bad.txt"
"${REC}" recover --bridge a --manifest "${DIR}/activation.json" --passphrase-file "${DIR}/bad.txt"
rc_bad=$?
"${REC}" recover --bridge c \
  --practice-share "${DIR}/vendor-recovery.share.v1.json" \
  --vendor-share "${DIR}/vendor-recovery.share.v1.json" \
  --vendor-sk "${DIR}/vendor-recovery.sk" \
  --passphrase-file "${PW_FILE}"
rc_vendor_as_practice=$?
set -e
[[ "${rc_bad}" -ne 0 ]]
[[ "${rc_vendor_as_practice}" -ne 0 ]]

echo "smoke-bridges: PASS (A==C, negatives fail)"
