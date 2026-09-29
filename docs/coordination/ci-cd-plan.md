# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

**Last updated:** 2026-09-29  
**Scope:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`

## Verified workspace layout

- **Rust workspace root:** `Cargo.toml` (`[workspace] members` include `apps/practice-host`, `crates/*`, `installer/*`).
- **JS workspace root:** `package.json` (`workspaces` include `apps/*`, `packages/*`, `website`).
- **Retired path risk:** old CI assumptions around legacy `app/` / `app/src-tauri` are now replaced by root-workspace checks.

## Tier design

### Tier 1 — `verify.yml` (blocking, no mutation)

Triggers: push to `main`, every PR, manual dispatch, reusable workflow call.

Checks:
- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- Web: lockfile-based package manager detection (pnpm/yarn/npm), then lint (without `--fix`), typecheck, test, build.
- A11y: axe-core scan on built UI; fails on any **critical** WCAG 2.1 AA violation.

Controls:
- `concurrency` with `cancel-in-progress: true`
- job-level `timeout-minutes`
- read-only workflow permissions

### Tier 2 — `autofix.yml` (PR heads only, deterministic only)

Trigger: `pull_request` only.

Fix scope:
- `cargo fmt --all`
- `lint:fix` and `format` scripts (if present)

Guardrails:
- loop guard: `if: github.actor != 'github-actions[bot]'`
- never runs on `push` to protected branches
- blocks commit when changed paths match `security|audit|crypto|rbac`
- commits only to the PR head branch

### Tier 3 — `fix-proposal.yml` (draft PR proposal, no auto-merge)

Triggers:
- manual dispatch
- failed `verify` run on `main` (`workflow_run`)

Flow:
1. Capture failing-before evidence (`cargo test`, `cargo audit`, JS `typecheck`).
2. Attempt substantive proposal fixes on a new branch (fmt/clippy-fix/lint-fix + dependency advisory refresh attempts).
3. Capture passing-after evidence.
4. Open a **draft PR** with before/after evidence and rationale.

Guardrails:
- no auto-merge
- if proposal diff touches `security|audit|crypto|rbac`, apply `needs-human-review` and stop workflow.

### Tier 4 — `release.yml` (gated, signed, zero mutation)

Triggers: tag push `v*`, manual dispatch.

Flow:
1. Re-run full verify gate using reusable `verify.yml`.
2. Require manual approval in protected `release` environment.
3. Build signed artifacts on Linux/macOS/Windows with `TAURI_SIGNING_PRIVATE_KEY`.
4. Upload signed bundle artifacts only.

Release guardrails:
- no source mutation
- reproducible from tagged commit
- timeout + concurrency termination

## Operational notes

- Root scripts now expose stable CI entry points:
  - `npm run typecheck`
  - `npm run lint:fix`
  - `npm run format`
  - `npm run test:a11y`
- Legacy `ci.yml` is kept as manual dispatch shim delegating to `verify.yml`.
