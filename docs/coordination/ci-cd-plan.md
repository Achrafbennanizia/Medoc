# MeDoc CI/CD pipeline plan (verify-first, safe auto-fix, gated release)

**Last updated:** 2026-08-26  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Workspace truth (used by workflows)

- **Rust workspace root:** `Cargo.toml` at repo root (`members` include `apps/practice-host`, `crates/*`).
- **JS workspace root:** `package.json` at repo root (`workspaces` include `apps/*`, `packages/*`).
- **Package manager detection rule:** lockfile probe in workflow runtime (`pnpm-lock.yaml` → `yarn.lock` → `package-lock.json`/npm fallback).

## Tier model

### Tier 1 — `verify.yml` (blocking, no mutation)

Trigger:

- every push
- every pull request
- reusable `workflow_call` (for release gate)

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lockfile-aware install + `lint`, `typecheck`, `test`, `build`
- Accessibility: `axe-core` via Playwright against built UI, failing on **critical** WCAG 2.1 A/AA violations

Controls:

- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`
- zero `--fix` behavior in verify jobs

### Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only

Fix scope (deterministic, logic-free only):

- `cargo fmt --all`
- `lint:fix`
- `format`

Controls:

- loop guard: skip bot-authored runs (`github.actor != 'github-actions[bot]'`)
- same-repository PRs only (no fork push attempt)
- commits only when the working tree changed
- never runs on `push` to `main` or on release refs

### Tier 3 — `fix-proposal.yml` (draft PR proposal path)

Trigger:

- manual `workflow_dispatch`
- failed `verify` run on `main` (`workflow_run`)

Behavior:

- checks out failing ref on a **new branch**
- captures failing-before logs
- attempts non-deterministic remediation via configured `FIX_PROPOSAL_COMMAND` or `scripts/ci/attempt-fix-proposal.sh`
- records passing-after verify evidence
- opens/updates a **draft PR** with rationale + before/after evidence

Guardrails:

- if changed files touch security/audit/crypto/RBAC surfaces, apply `needs-human-review`
- no auto-merge path

### Tier 4 — `release.yml` (gated, reproducible, signed)

Trigger:

- tag push `v*`
- manual `workflow_dispatch`

Behavior:

- runs Tier 1 verify as a reusable gate job
- builds signed bundles on Ubuntu/macOS/Windows under protected `release` environment
- uploads release artifacts
- generates build provenance attestation

Guarantee:

- release path verifies and signs the tagged commit only; source is not mutated

## Guardrail matrix

1. Verify jobs are read-only against source state.
2. Auto-fix runs only on PR heads and uses deterministic fixers.
3. Bot loop guard prevents recursive auto-fix churn.
4. Non-deterministic fixes are always draft PR proposals.
5. Protected code surfaces require explicit human review.
6. Concurrency + timeouts are applied so runs terminate.
7. Release runs with manual approval through the `release` environment.

## Workflow file map

- `.github/workflows/verify.yml`
- `.github/workflows/autofix.yml`
- `.github/workflows/fix-proposal.yml`
- `.github/workflows/release.yml`
- `.github/workflows/ci.yml` (compat wrapper to `verify.yml`)
