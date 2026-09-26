# MeDoc CI/CD plan (verify, safe autofix, gated release)

**Status:** Implemented in `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, and `release.yml`  
**Last updated:** 2026-09-26

## Workspace truth used by CI

- Rust workspace is rooted at `Cargo.toml` and includes `apps/*` + `crates/*`.
- JavaScript workspace is rooted at `package.json` and includes `apps/*` + `packages/*`.
- CI lockfile detection is dynamic (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`/npm).
- Legacy `app/`/`app/src-tauri` paths are not used by the tiered CI workflows.

## Tier model

### Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:
- `push`
- `pull_request`
- `workflow_call` (reused by release gate)

Checks:
- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: install via detected package manager, then lint (no `--fix`), typecheck/check, test, build
- A11y: run axe-core against the built UI and fail on critical WCAG 2.1 AA findings

Guardrails:
- No verify step writes back to git history.
- Concurrency cancellation is enabled (`cancel-in-progress: true`).
- All jobs are bounded with explicit timeouts.

### Tier 2 — `autofix.yml` (PR branches only, deterministic fixes)

Triggers:
- `pull_request`

Scope:
- Runs only when `github.actor != 'github-actions[bot]'`
- Runs only for same-repo PR branches (`head.repo.full_name == github.repository`)

Fixes allowed:
- `cargo fmt --all`
- `lint:fix` if present, otherwise `lint -- --fix` fallback
- `format` script if present

Guardrails:
- Deterministic, logic-free fixes only.
- Commits only when changes exist.
- Pushes back to PR head branch to re-trigger verify.
- Loop guard prevents the bot from re-triggering autofix indefinitely.

### Tier 3 — `fix-proposal.yml` (draft PR proposals for substantive fixes)

Triggers:
- `workflow_dispatch`
- `workflow_run` when `verify` fails on `push` to `main`

Behavior:
- Creates a new proposal branch (`ci/fix-proposal-*`)
- Captures before/after evidence logs around fix attempt
- Runs a configurable fix agent command (`workflow_dispatch` input `fix_command` or repository variable `MEDOC_FIX_AGENT_COMMAND`)
- Opens a **draft** PR with rationale and evidence references

Guardrails:
- Never auto-merges.
- Fails if no diff is produced.
- If diff touches `security`, `audit`, `crypto`, or `rbac` paths, labels PR `needs-human-review` and stops.

### Tier 4 — `release.yml` (gated release, zero source mutation)

Triggers:
- tag push (`v*`)
- `workflow_dispatch`

Behavior:
- Re-runs full verify via reusable workflow call (`gate` job)
- Builds signed bundles on Ubuntu/Windows/macOS
- Requires protected `release` environment approval before artifact creation
- Uploads signed bundles as artifacts

Guardrails:
- Release job does not run format/lint fixers.
- No source commits are created in release.
- Concurrency cancellation + timeout are enabled.

## Operational notes

1. Configure branch protection to require **verify** checks, not the legacy CI check name.
2. Keep `.github/workflows/ci.yml` only as a manual legacy wrapper.
3. Configure protected `release` environment reviewers per `freigabeprozess.md`.
4. Set `MEDOC_FIX_AGENT_COMMAND` if Tier 3 should auto-attempt fixes without manual input.
