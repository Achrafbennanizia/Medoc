# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-25  
**Scope:** `.github/workflows/` for the live root workspaces (`Cargo.toml`, `package-lock.json`)  
**Runtime target:** verify + gate merges/releases; mutation only where explicitly allowed.

## Workspace truth used by CI

- **Rust workspace:** root `Cargo.toml` members under `apps/*` and `crates/*`.
- **JS workspace:** root `package.json` + lockfile (`pnpm-lock.yaml` or `yarn.lock` or `package-lock.json`) with package `medoc` in `apps/practice-host-ui`.
- **Legacy CI path migration:** retired `.github/workflows/ci.yml` is replaced by explicit tiered workflows.

## Tier 1 — verify (`.github/workflows/verify.yml`)

- **Triggers:** `push` on `main`, all `pull_request`s, and `workflow_call` (for release gate).
- **Mutation policy:** none (read-only verification).
- **Guards:** `concurrency.cancel-in-progress: true`; per-job timeouts.
- **Rust checks:** `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- **Web checks:** package-manager detection from lockfile, then lint (no `--fix`), typecheck, test, build.
- **A11y checks:** build UI, run `axe-core` audit via Playwright on critical WCAG 2.1 AA findings only; fail on any critical violation.

## Tier 2 — autofix (`.github/workflows/autofix.yml`)

- **Trigger:** `pull_request` only.
- **Mutation policy:** PR head branch only.
- **Guards:**
  - loop guard: `if: github.actor != 'github-actions[bot]'`
  - same-repo PR only (avoids fork write failures)
  - deterministic fixes only
  - `concurrency.cancel-in-progress: true`
  - job timeout
- **Allowed commands:** `cargo fmt --all`, `lint:fix`, `format`.
- **Commit behavior:** commits and pushes only when the tree changed.

## Tier 3 — fix proposal (`.github/workflows/fix-proposal.yml`)

- **Triggers:** manual `workflow_dispatch` and failed `verify` runs on `main` (`workflow_run`).
- **Mutation policy:** draft-PR proposal only (never auto-merge).
- **Flow:**
  1. Capture failing-before evidence (`cargo test`, `cargo audit`, web `typecheck` exit codes + logs).
  2. Run proposal command (`proposal_command` input or `CI_FIX_PROPOSAL_COMMAND` repo variable).  
     Fallback command is deterministic hygiene (`cargo fmt` + `lint:fix` + `format`).
  3. Capture passing-after evidence with the same checks.
  4. Open a **draft PR** on a new branch with rationale + before/after evidence.
- **Sensitive-path guard:** if changed files include security/audit/crypto/RBAC paths, add label `needs-human-review` and stop the job after creating the draft PR.

## Tier 4 — release (`.github/workflows/release.yml`)

- **Triggers:** tag push `v*` and manual `workflow_dispatch`.
- **Mutation policy:** no source mutation; build from the tagged commit.
- **Gate:** re-runs full tier-1 verify via reusable workflow call.
- **Manual approval:** protected `release` environment.
- **Build:** cross-platform matrix (`ubuntu`, `windows`, `macos`), signed Tauri bundles.
- **Output controls:** upload artifacts per OS and emit build provenance attestation.

## Global guardrails implemented

1. Verify/release jobs do not mutate repository source.
2. Auto-fix runs only on PR events and never on `main`/tags.
3. Bot-loop guard prevents infinite autofix recursion.
4. Deterministic-only commands in tier 2.
5. Sensitive security/audit/crypto/RBAC changes in tier 3 are labeled `needs-human-review`.
6. Each workflow has timeout + concurrency cancellation.
7. Release artifacts are built from the gated tagged commit with signing env and protected approval gate.
