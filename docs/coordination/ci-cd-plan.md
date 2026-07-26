# MeDoc CI/CD pipeline plan

**Last updated:** 2026-07-26  
**Scope:** Verification-first CI/CD with guarded auto-fix and gated release.

## Verified workspace targets

- **Rust workspace:** root `Cargo.toml` members in `apps/practice-host` and `crates/**`.
- **JS workspace:** root `package.json` workspaces in `apps/**` and `packages/**`.
- **Retired monolith CI path:** `.github/workflows/ci.yml` has been replaced by tiered workflows.

## Pipeline tiers

### Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:

- `push` to `main`
- `pull_request`
- `workflow_call` (reused by release gate)

Jobs:

1. **Rust verify**
   - `cargo fmt --all -- --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
   - `cargo audit`

2. **Web verify**
   - Detect package manager from lockfile (`pnpm`/`yarn`/`npm`)
   - Install with lockfile integrity
   - `lint` (without `--fix`)
   - `typecheck`
   - `test`
   - `build`

3. **Accessibility verify**
   - Build web UI
   - Run axe-core against built UI preview
   - Fail on **critical** WCAG 2.1 A/AA violations

Guardrails:

- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`
- read-only permissions

### Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only

Behavior:

- Loop guard: `if: github.actor != 'github-actions[bot]'`
- Deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Commit/push changes back to PR head branch only if git tree changed.

Guardrails:

- never runs on `push` to `main`
- never runs on release path
- concurrency cancellation enabled

### Tier 3 — `fix-proposal.yml` (draft PR proposal path)

Triggers:

- manual `workflow_dispatch`
- failed Tier 1 on `main` via `workflow_run`

Behavior:

1. Capture **failing-before** baseline command status.
2. Run optional non-deterministic fix command through secret `CI_FIX_AGENT_COMMAND`.
3. Capture **passing-after** baseline command status.
4. Write evidence to `.github/fix-proposal/evidence.md`.
5. Open a **draft** PR from a new branch (`ci/fix-proposal-<run_id>`).

Sensitive-path guard:

- If changed paths include `security`, `audit`, `crypto`, or `rbac`, apply `needs-human-review` label and stop the workflow for manual review.

### Tier 4 — `release.yml` (gated, reproducible release)

Triggers:

- tag push `v*`
- manual `workflow_dispatch`

Behavior:

1. Re-run full verify gate (`uses: ./.github/workflows/verify.yml`) on release commit.
2. Build signed bundles on Linux, Windows, macOS in protected `release` environment.
3. Upload artifacts only; no source edits.

Guardrails:

- protected environment approval gate (`environment: release`)
- verify-first dependency (`needs: gate`)
- no fix/mutation steps in release workflow

## Added JS support scripts for CI tiers

- Root `package.json`:
  - `typecheck`
  - `lint:fix`
  - `format`
  - `test:a11y`
- `apps/practice-host-ui/package.json`:
  - `typecheck` (`tsc --noEmit`)
  - `lint:fix` (eslint with `--fix`)
  - `format` (prettier)
  - `test:a11y` (axe runner script)
- `scripts/run-axe-a11y.mjs`:
  - launches built preview
  - runs axe-core via Playwright
  - fails only on critical WCAG 2.1 A/AA issues

## Notes

- Tier 3 is intentionally draft-only and requires human merge decisions.
- Tier 3 agent logic is externally configurable through `CI_FIX_AGENT_COMMAND` to keep the workflow repo-agnostic while preserving guardrails.
