#!/usr/bin/env bash
set -euo pipefail

result_dir="${FIX_PROPOSAL_RESULT_DIR:-.github/ci-fix-proposal}"
mkdir -p "${result_dir}"

before_log="${result_dir}/before.log"
after_log="${result_dir}/after.log"
attempt_log="${result_dir}/attempt.log"
summary_path="${result_dir}/summary.md"

: >"${before_log}"
: >"${after_log}"
: >"${attempt_log}"

if [[ -f pnpm-lock.yaml ]]; then
  pm="pnpm"
  pm_run="pnpm run"
elif [[ -f yarn.lock ]]; then
  pm="yarn"
  pm_run="yarn"
else
  pm="npm"
  pm_run="npm run"
fi

declare -A before_status
declare -A after_status

run_check() {
  local stage="$1"
  local key="$2"
  local command="$3"
  local log_file="$4"
  local status_ref="$5"
  local -n status_map="${status_ref}"

  echo "[${stage}] ${command}" >>"${log_file}"
  set +e
  bash -lc "${command}" >>"${log_file}" 2>&1
  local code=$?
  set -e
  status_map["${key}"]="${code}"
}

run_check "before" "cargo_test" "cargo test --workspace" "${before_log}" before_status
run_check "before" "cargo_audit" "cargo audit" "${before_log}" before_status
run_check "before" "js_typecheck" "${pm_run} typecheck" "${before_log}" before_status
run_check "before" "js_test" "${pm_run} test" "${before_log}" before_status

{
  echo "[attempt] cargo fix --workspace --all-targets --allow-dirty --allow-staged"
  cargo fix --workspace --all-targets --allow-dirty --allow-staged || true
  echo "[attempt] cargo update --workspace"
  cargo update --workspace || true
  if [[ "${pm}" == "npm" ]]; then
    echo "[attempt] npm audit fix --package-lock-only"
    npm audit fix --package-lock-only || true
  else
    echo "[attempt] ${pm} advisory auto-update skipped (not configured)"
  fi
} >>"${attempt_log}" 2>&1

run_check "after" "cargo_test" "cargo test --workspace" "${after_log}" after_status
run_check "after" "cargo_audit" "cargo audit" "${after_log}" after_status
run_check "after" "js_typecheck" "${pm_run} typecheck" "${after_log}" after_status
run_check "after" "js_test" "${pm_run} test" "${after_log}" after_status

status_cell() {
  local code="$1"
  if [[ "${code}" == "0" ]]; then
    printf "PASS (0)"
  else
    printf "FAIL (%s)" "${code}"
  fi
}

cat >"${summary_path}" <<EOF
## Tier 3 fix proposal evidence

- Package manager: \`${pm}\`
- Fix attempts:
  - \`cargo fix --workspace --all-targets --allow-dirty --allow-staged\`
  - \`cargo update --workspace\`
  - \`npm audit fix --package-lock-only\` (npm only)

| Check | Before | After |
|---|---|---|
| cargo test --workspace | $(status_cell "${before_status[cargo_test]}") | $(status_cell "${after_status[cargo_test]}") |
| cargo audit | $(status_cell "${before_status[cargo_audit]}") | $(status_cell "${after_status[cargo_audit]}") |
| ${pm_run} typecheck | $(status_cell "${before_status[js_typecheck]}") | $(status_cell "${after_status[js_typecheck]}") |
| ${pm_run} test | $(status_cell "${before_status[js_test]}") | $(status_cell "${after_status[js_test]}") |

### Logs

- Before checks: \`${before_log}\`
- Fix attempt: \`${attempt_log}\`
- After checks: \`${after_log}\`
EOF

echo "Fix proposal summary written to ${summary_path}"
