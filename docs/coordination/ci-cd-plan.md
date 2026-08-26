# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

Last updated: 2026-08-26

## Verified workspace targets

- **Rust workspace root:** `Cargo.toml` with members under `apps/` and `crates/`.
- **JS workspace root:** `package.json` workspaces under `apps/*` and `packages/*`.
- **Workflows path:** `.github/workflows/`.

## Tier model

### Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:

- every `push`
- every `pull_request`
- reusable from other workflows via `workflow_call`

Checks:

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`
- JS package manager detection from lockfile (`pnpm` / `yarn` / `npm`)
- JS lint (without `--fix`), type-check, test, build
- axe-core scan of built UI, failing on **critical** WCAG 2.1 A/AA violations

Operational controls:

- `concurrency.cancel-in-progress: true`
- per-job timeouts (Rust 30m, Web 30m, A11y 20m)

### Tier 2 — `autofix.yml` (PR head only, deterministic only)

Trigger:

- `pull_request` only

Fix scope:

- `cargo fmt --all`
- `lint:fix` (if defined)
- `format` (if defined)

Guards:

- loop guard: skips when actor is `github-actions[bot]`
- only pushes to PR head branch on same repository
- blocks automated commits if changed paths match sensitive domains:
  - `security`
  - `audit`
  - `crypto`
  - `rbac`

### Tier 3 — `fix-proposal.yml` (draft PR, no auto-merge)

Trigger:

- manual `workflow_dispatch`
- `workflow_run` when `verify` fails on `main`

Behavior:

- checks out failing commit context
- runs configurable agent command from repository variable:
  - `CI_FIX_PROPOSAL_AGENT_CMD`
- records failing-before and passing-after evidence
- opens a **draft** PR on a new branch with the proposal diff + report
- if sensitive paths are touched, applies label `needs-human-review` and stops the run

### Tier 4 — `release.yml` (tag/dispatch, verify gate, signed artifacts)

Trigger:

- tag push `v*`
- manual `workflow_dispatch`

Release flow:

1. Re-run full verify by reusing `verify.yml`.
2. Build signed artifacts on Linux/macOS/Windows in protected `release` environment.
3. Upload bundles and provenance attestations.

Policy:

- no source mutation during release path
- release artifacts are built from the tagged commit after verify gate

## Guardrails applied across tiers

1. Verify jobs are non-mutating.
2. Autofix is PR-only and deterministic.
3. No auto-fix to protected/release paths.
4. Compliance-sensitive paths are blocked from automated commit flows.
5. Every workflow has timeout + cancelable concurrency to avoid stuck loops.
6. Fix proposals are always draft PRs for human review (no auto-merge).
