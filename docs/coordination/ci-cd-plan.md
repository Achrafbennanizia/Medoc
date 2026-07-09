# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

**Last updated:** 2026-07-09  
**Workflows:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`

## 1) Workspace truth used by CI

- **Rust workspace:** repo root `Cargo.toml` with members under `apps/` and `crates/`.
- **JavaScript workspace:** repo root `package.json` with npm workspaces under `apps/*` and `packages/*`.
- **Retired path migration:** legacy `.github/workflows/ci.yml` was removed and replaced by tiered workflows wired to current workspace layout.

## 2) Tier model

### Tier 1 — Verify (`verify.yml`)

**Triggers:** `push` to `main`, every `pull_request`, and `workflow_call` (for release gate)  
**Mutation:** none

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: package-manager auto-detection (`pnpm`/`yarn`/`npm`), then lint (no `--fix`), typecheck, tests, build
- Accessibility: `axe-core` scan against built UI (`npm run test:a11y`) and fail on **critical** WCAG 2.1 AA violations

Controls:

- `concurrency.cancel-in-progress: true`
- per-job timeouts (`30m` rust/web, `20m` a11y)

### Tier 2 — Auto-fix (`autofix.yml`)

**Trigger:** `pull_request` only  
**Mutation:** yes, only on PR head branch and only deterministic formatting/lint fixes

Actions:

- `cargo fmt --all`
- workspace `lint:fix`
- workspace `format`
- commit and push if diff exists

Guards:

- loop guard: skip when actor is `github-actions[bot]`
- no execution for fork PR heads
- never runs on `push main` or release flows

### Tier 3 — Fix proposal (`fix-proposal.yml`)

**Triggers:** manual dispatch; failed `verify` run on `main` (`workflow_run`)  
**Mutation:** new branch only (`ci/fix-proposal-<run_id>`), never direct `main`

Flow:

1. Re-run a declared failing command and record **before** evidence.
2. Run configured substantive fix command.
3. Re-run failing command and record **after** evidence.
4. Commit diff to proposal branch.
5. Open **draft PR** with rationale + before/after exit evidence.

Safety:

- If changed paths include `security`, `audit`, `crypto`, or `rbac`, add label `needs-human-review` and stop job with non-success.
- No auto-merge behavior.

### Tier 4 — Release (`release.yml`)

**Triggers:** tag push `v*` or manual dispatch  
**Mutation:** none to source tree

Flow:

1. `gate` job reuses Tier-1 verify via `workflow_call`.
2. `build` job runs only after gate pass.
3. Build matrix for Linux/macOS/Windows in protected `release` environment.
4. Verify tagged commit again (`cargo test --workspace`) before bundle build.
5. Build signed artifacts (`tauri build`) and upload bundles.

Controls:

- protected `release` environment is manual approval gate
- `concurrency.cancel-in-progress: true`
- `timeout-minutes: 60`

## 3) Global guardrails

1. Verify jobs do not mutate repository state.
2. Auto-fix runs only on PR branches with deterministic commands.
3. No bot loop on autofix commits.
4. Substantive fixes are draft PR proposals, not direct protected-branch writes.
5. Security/audit/crypto/RBAC touching proposals are always human-gated with label enforcement.
6. Release artifacts are built from verified, tagged commits with signing configured from secrets.
