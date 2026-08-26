#!/usr/bin/env bash
set -euo pipefail

PM="${PM:-npm}"
REPORT_PATH="${REPORT_PATH:-/tmp/fix-proposal-report.md}"
LOG_DIR="${LOG_DIR:-/tmp/fix-proposal-logs}"
SOURCE_RUN_URL="${SOURCE_RUN_URL:-N/A}"
TRIGGER_REASON="${TRIGGER_REASON:-manual-dispatch}"

mkdir -p "$LOG_DIR"

case "$PM" in
  pnpm)
    MEDOC_TYPECHECK_CMD="pnpm --filter medoc run typecheck"
    ;;
  yarn)
    MEDOC_TYPECHECK_CMD="yarn workspace medoc run typecheck"
    ;;
  npm)
    MEDOC_TYPECHECK_CMD="npm run typecheck -w medoc"
    ;;
  *)
    echo "Unsupported package manager: $PM" >&2
    exit 1
    ;;
esac

run_cmd() {
  local name="$1"
  shift
  local cmd="$*"
  set +e
  bash -lc "$cmd" >"$LOG_DIR/$name.log" 2>&1
  local status=$?
  set -e
  echo "$status"
}

status_label() {
  if [ "$1" -eq 0 ]; then
    echo "PASS"
  else
    echo "FAIL ($1)"
  fi
}

before_cargo_test="$(run_cmd before-cargo-test "cargo test --workspace")"
before_cargo_audit="$(run_cmd before-cargo-audit "cargo audit")"
before_typecheck="$(run_cmd before-typecheck "$MEDOC_TYPECHECK_CMD")"

attempt_notes="- Reproduced failing signals before remediation."
if [ "$before_cargo_audit" -ne 0 ]; then
  run_cmd remediation-cargo-update "cargo update --workspace" >/dev/null
  attempt_notes="$attempt_notes
- Ran \`cargo update --workspace\` as an advisory remediation attempt."
else
  attempt_notes="$attempt_notes
- Skipped \`cargo update --workspace\` because \`cargo audit\` was already green."
fi

after_cargo_test="$(run_cmd after-cargo-test "cargo test --workspace")"
after_cargo_audit="$(run_cmd after-cargo-audit "cargo audit")"
after_typecheck="$(run_cmd after-typecheck "$MEDOC_TYPECHECK_CMD")"

cat >"$REPORT_PATH" <<EOF
# CI fix proposal report

Trigger reason: ${TRIGGER_REASON}  
Source run: ${SOURCE_RUN_URL}

## Remediation attempt

${attempt_notes}

## Failing-before / passing-after evidence

| Check | Before | After |
| --- | --- | --- |
| \`cargo test --workspace\` | $(status_label "$before_cargo_test") | $(status_label "$after_cargo_test") |
| \`cargo audit\` | $(status_label "$before_cargo_audit") | $(status_label "$after_cargo_audit") |
| \`medoc typecheck\` | $(status_label "$before_typecheck") | $(status_label "$after_typecheck") |

## Log paths

- \`$LOG_DIR/before-cargo-test.log\`
- \`$LOG_DIR/before-cargo-audit.log\`
- \`$LOG_DIR/before-typecheck.log\`
- \`$LOG_DIR/after-cargo-test.log\`
- \`$LOG_DIR/after-cargo-audit.log\`
- \`$LOG_DIR/after-typecheck.log\`
EOF

echo "Wrote $REPORT_PATH"
