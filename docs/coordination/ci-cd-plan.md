# MeDoc CI/CD plan (verify, safe autofix, gated release)

Last updated: 2026-07-09

## Goal

The pipeline verifies and gates merges/releases without mutating protected paths.  
Code mutation is restricted to deterministic autofixes on pull-request head branches.

## Workspace detection (live paths)

- Rust workspace root: `Cargo.toml` at repository root (`members` include `apps/practice-host`, `crates/*`).
- JavaScript workspace root: `package.json` at repository root (`workspaces` include `apps/*`, `packages/*`).
- Legacy `.github/workflows/ci.yml` has been replaced by tiered workflows:
  - `.github/workflows/verify.yml`
  - `.github/workflows/autofix.yml`
  - `.github/workflows/fix-proposal.yml`
  - `.github/workflows/release.yml`

## Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:

- every `push`
- every `pull_request`
- `workflow_call` (for release gate reuse)

Jobs:

- **rust**: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- **web**: package-manager detection from lockfile (pnpm/yarn/npm), then lint (without fix), typecheck, test, build
- **a11y**: builds the UI and runs axe-core against the previewed build; fails on **critical** WCAG 2.1 AA violations

Safety controls:

- `concurrency.cancel-in-progress: true`
- job timeouts (`rust/web`: 30 min, `a11y`: 20 min)

## Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only

Behavior:

- Loop guard: skips when actor is `github-actions[bot]`
- Applies deterministic fixes only:
  - `cargo fmt --all`
  - workspace `lint:fix`
  - workspace `format`
- Commits and pushes only when changes exist

Safety controls:

- `permissions.contents: write` only
- `concurrency.cancel-in-progress: true`
- timeout: 20 min
- blocks and fails if autofix touches `security|audit|crypto|rbac` paths

## Tier 3 — `fix-proposal.yml` (draft PR proposals)

Triggers:

- manual `workflow_dispatch`
- automatic on failed `verify` workflow runs on `main`

Behavior:

- checks out failing ref on a **new branch**
- captures failing-before and passing-after command status snapshots
- attempts proposal-only remediation (`cargo fix`, formatter/lint fixers, advisory fix for npm)
- opens a **draft PR** with rationale + evidence table
- never auto-merges

Safety controls:

- if diff touches `security|audit|crypto|rbac`, applies `needs-human-review` label
- timeout: 60 min
- `concurrency.cancel-in-progress: true`

## Tier 4 — `release.yml` (gated, no source mutation)

Triggers:

- tags `v*`
- manual `workflow_dispatch`

Behavior:

- re-runs full verification by calling `verify.yml` (`gate` job)
- builds signed cross-platform bundles in protected `release` environment
- uploads artifacts per OS
- emits provenance attestation

Safety controls:

- protected `environment: release` (manual approval gate)
- no source edits in release path
- job timeout: 60 min
- `concurrency.cancel-in-progress: true`

## Guardrails (always-on policy)

1. Verify jobs never mutate source.
2. Autofix runs only on PR branches, with loop guard.
3. Deterministic fixes only in tier 2.
4. Non-deterministic fixes only in tier 3 as draft PR proposals.
5. Security/audit/crypto/RBAC changes are human-gated.
6. Release is verify + sign only, with manual approval.
