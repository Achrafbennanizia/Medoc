#!/usr/bin/env bash
set -euo pipefail

reason="${1:-verify_red_main}"
report_dir="docs/coordination/ci-fix-proposals"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
report_path="${report_dir}/${timestamp}-${reason}.md"

mkdir -p "$report_dir"

cat > "$report_path" <<EOF
# CI fix proposal attempt

- Timestamp (UTC): ${timestamp}
- Reason: ${reason}
- Branch baseline: $(git rev-parse --abbrev-ref HEAD)
- Commit baseline: $(git rev-parse HEAD)

## Failing-before evidence

EOF

run_capture() {
    local label="$1"
    local command="$2"
    local tmp
    tmp="$(mktemp)"

    {
        echo "### ${label}"
        echo
        echo '```bash'
        echo "${command}"
        echo '```'
        echo
    } >> "$report_path"

    set +e
    bash -lc "$command" >"$tmp" 2>&1
    local status=$?
    set -e

    {
        echo '```text'
        cat "$tmp"
        echo '```'
        echo
        echo "Exit code: ${status}"
        echo
    } >> "$report_path"

    rm -f "$tmp"
}

capture_before() {
    case "$reason" in
        advisory)
            run_capture "cargo audit (before)" "cargo audit"
            run_capture "npm audit --omit=dev (before)" "npm audit --omit=dev"
            ;;
        type_error)
            run_capture "npm run typecheck (before)" "npm run typecheck"
            ;;
        test_failure)
            run_capture "cargo test --workspace (before)" "cargo test --workspace"
            run_capture "npm test (before)" "npm test"
            ;;
        *)
            run_capture "cargo test --workspace (before)" "cargo test --workspace"
            run_capture "npm run typecheck (before)" "npm run typecheck"
            ;;
    esac
}

attempt_fixes() {
    {
        echo "## Automated fix attempt"
        echo
    } >> "$report_path"

    case "$reason" in
        advisory)
            run_capture "cargo update -w" "cargo update -w"
            run_capture "npm audit fix --package-lock-only --omit=dev" "npm audit fix --package-lock-only --omit=dev"
            ;;
        type_error|test_failure|verify_red_main)
            # Tier 3 intentionally avoids deterministic format-only fixes (handled by tier 2).
            # For non-deterministic failures, this proposal captures reproducible evidence and
            # leaves the substantive patch for human-reviewed follow-up.
            run_capture "No deterministic patch applied" "echo 'Substantive fix requires targeted code change and human review.'"
            ;;
        *)
            run_capture "No deterministic patch applied" "echo 'Unknown reason; skipping automated mutation.'"
            ;;
    esac
}

capture_after() {
    {
        echo "## Passing-after evidence"
        echo
    } >> "$report_path"

    case "$reason" in
        advisory)
            run_capture "cargo audit (after)" "cargo audit"
            run_capture "npm audit --omit=dev (after)" "npm audit --omit=dev"
            ;;
        type_error)
            run_capture "npm run typecheck (after)" "npm run typecheck"
            ;;
        test_failure)
            run_capture "cargo test --workspace (after)" "cargo test --workspace"
            run_capture "npm test (after)" "npm test"
            ;;
        *)
            run_capture "cargo test --workspace (after)" "cargo test --workspace"
            run_capture "npm run typecheck (after)" "npm run typecheck"
            ;;
    esac
}

capture_before
attempt_fixes
capture_after

{
    echo "## Files changed by this attempt"
    echo
    echo '```text'
    git diff --name-only
    echo '```'
    echo
} >> "$report_path"

echo "$report_path"
