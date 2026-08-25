# MeDoc CI/CD pipeline plan (verify-first, safe auto-fix, gated release)

## Purpose

This pipeline enforces a single release rule: **the shipped artifact must come from a reviewed commit that verification did not mutate**.

- Verification jobs only check and fail/pass.
- Auto-fix is limited to deterministic formatting/linting and only on PR head branches.
- Non-deterministic fixes are proposed through draft PRs for human review.
- Release re-runs verification and builds signed artifacts under a protected environment gate.

## Workspace detection (live repo layout)

Verified from repository manifests:

- Rust workspace root: `Cargo.toml`
  - members include `apps/practice-host`, `crates/*`, and `crates/test/*`.
- JavaScript workspace root: `package.json`
  - workspaces include `apps/*` and `packages/*`.

The legacy `.github/workflows/ci.yml` that referenced retired paths was removed and replaced by workspace-root workflows.

## Workflow tiers

### Tier 1 — `verify.yml` (blocking; no mutation)

File: `.github/workflows/verify.yml`

Triggers:
- `push` on `main`
- `pull_request`
- `workflow_call` (used by release gate)

Checks:
- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`
- Web: lockfile-driven package manager detection (`pnpm`/`yarn`/`npm`), then lint/typecheck/test/build without `--fix`
- Accessibility: build UI, run `axe-core` against built output, fail on **critical** WCAG 2.1 A/AA violations

Controls:
- `concurrency.cancel-in-progress: true`
- per-job timeouts

### Tier 2 — `autofix.yml` (PR only; deterministic fixes only)

File: `.github/workflows/autofix.yml`

Trigger:
- `pull_request` only

Deterministic fixes:
- `cargo fmt --all`
- optional `lint:fix` (if script exists)
- optional `format` (if script exists)

Controls:
- loop guard: `if: github.actor != 'github-actions[bot]'`
- no `push` trigger on `main`
- commits only when tree changed
- concurrency cancellation + timeout

### Tier 3 — `fix-proposal.yml` (non-deterministic fixes via draft PR)

File: `.github/workflows/fix-proposal.yml`

Triggers:
- `workflow_dispatch` (manual class selection: `test`, `advisory`, `typecheck`)
- `workflow_run` when `verify` fails on `main`

Behavior:
- attempts targeted fixes on an isolated proposal branch
- records failing-before and passing-after evidence
- opens a **draft PR** (never auto-merges)

Sensitive code guard:
- if changed paths match `security|audit|crypto|rbac|auth|secret|key`, workflow adds `needs-human-review` label and stops progression.

### Tier 4 — `release.yml` (verify gate + signed build; no mutation)

File: `.github/workflows/release.yml`

Triggers:
- tag push `v*`
- `workflow_dispatch`

Flow:
1. `gate` job calls Tier 1 verify (`uses: ./.github/workflows/verify.yml`)
2. `build` job runs on Linux/Windows/macOS under protected `environment: release`
3. verifies tests on tagged commit and builds signed Tauri bundles
4. uploads signed artifacts

Controls:
- no source rewrite steps
- concurrency cancellation
- per-job timeout

## Global guardrails implemented

1. Verify jobs never mutate source.
2. Auto-fix runs only on PR branches, not protected/release paths.
3. Bot loop guard prevents recursive autofix commits.
4. Tier 2 remains deterministic and logic-free.
5. Tier 3 uses draft PR review for substantive changes.
6. All jobs use timeouts and concurrency controls to terminate superseded runs.
7. Release path is gated, signed, and reproducible from the tagged commit.
