# MeDoc CI/CD plan — verify, safe auto-fix, gated release

Last updated: 2026-08-26

## Core release rule

Release gates verify artifacts from reviewed commits. They do not rewrite source.

- Verify workflows are non-mutating.
- Auto-fix is deterministic only and scoped to pull-request head branches.
- Non-deterministic fixes are proposed in draft PRs for human review.
- Release re-verifies and signs tagged commits under protected manual approval.

## Workspace detection (authoritative)

- Rust workspace root: `Cargo.toml` with members under `apps/` and `crates/`.
- JavaScript workspace root: `package.json` with workspaces under `apps/` and `packages/`.
- Lockfile detection in workflows chooses package manager in this order:
  1. `pnpm-lock.yaml`
  2. `yarn.lock`
  3. fallback `package-lock.json` (`npm ci`)

## Pipeline tiers

### Tier 1 — `verify.yml` (blocking, no mutation)

Trigger:

- `push` to `main`
- `pull_request`
- `workflow_call` (for release gate reuse)

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lint (no `--fix`), typecheck, test, build
- Accessibility: axe-core WCAG 2.1 A/AA scan against built UI, fails on critical violations

Operational guardrails:

- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`

### Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only

Fix scope (deterministic, logic-free):

- `cargo fmt --all`
- `lint:fix` (if configured)
- `format` (if configured)

Safety:

- loop guard: skip when actor is `github-actions[bot]`
- no run on `push` to `main`
- no run on release tags/dispatch
- commits only to PR head branch

### Tier 3 — `fix-proposal.yml` (draft PR proposal, non-deterministic attempts)

Trigger:

- manual `workflow_dispatch`
- `workflow_run` when `verify` fails on `main`

Behavior:

- create a new `ci/fix-proposal-*` branch from target ref
- capture failing-before evidence (`cargo test`, `cargo audit`, `typecheck`)
- attempt dependency remediations (`cargo update` from audit findings, `npm audit fix --package-lock-only` when npm lockfile exists)
- capture passing-after evidence
- write rationale/evidence report to `docs/coordination/ci-fix-proposals/<run-id>.md`
- open a **draft** PR (never auto-merge)

Sensitive-path guard:

- if diff touches `security`, `audit`, `crypto`, or `rbac` paths, add `needs-human-review` label and stop.

### Tier 4 — `release.yml` (verify + signed build + manual gate)

Trigger:

- tag push `v*`
- manual `workflow_dispatch`

Behavior:

- `gate` job reuses full `verify.yml` via `workflow_call`
- `build` job runs in protected `release` environment (manual approval)
- re-runs verification commands and builds signed Tauri bundles
- uploads signed cross-platform bundles as artifacts

Safety:

- no source mutation in release
- deterministic artifact provenance from the tagged commit
- concurrency + timeout controls for terminable runs
