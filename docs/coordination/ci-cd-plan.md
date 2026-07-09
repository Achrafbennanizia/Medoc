# MeDoc CI/CD plan (verify, safe autofix, gated release)

## Scope and intent

The CI/CD pipeline verifies and gates merges/releases for the live MeDoc workspace:

- Rust workspace: `apps/*`, `crates/*` (repo-root `Cargo.toml`)
- JS workspace: `apps/*`, `packages/*` (repo-root `package.json`)

Release artifacts must always match reviewed source commits. Verification paths do not mutate source.

## Workflow map

| Tier | Workflow | Trigger | Repo mutation |
| --- | --- | --- | --- |
| Tier 1 | `.github/workflows/ci.yml` -> `.github/workflows/verify.yml` | every push + PR | no |
| Tier 2 | `.github/workflows/autofix.yml` | PR only | yes, PR head branch only |
| Tier 3 | `.github/workflows/fix-proposal.yml` | manual dispatch or failed main verify (`workflow_run`) | yes, new proposal branch + draft PR |
| Tier 4 | `.github/workflows/release.yml` | tag `v*` or manual dispatch | no source mutation |

## Tier details

### Tier 1 - verify (blocking, zero mutation)

`verify.yml` is reusable and called by:

- `ci.yml` on every push + PR
- `release.yml` as a gate before signed builds

Checks:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`
- Web: package-manager auto-detect (`pnpm`, `yarn`, `npm`), then lint (no fix), typecheck (`tsc --noEmit`), test, build
- A11y: build + axe-core run, failing when critical WCAG 2.1 AA violations exist

Controls:

- concurrency cancel-in-progress
- per-job timeouts
- no `--fix` flags in verify jobs

### Tier 2 - autofix (deterministic and safe)

`autofix.yml` runs on `pull_request` only with:

- loop guard: `github.actor != 'github-actions[bot]'`
- same-repo guard: no fork push attempts
- deterministic-only fix commands: `cargo fmt`, lint autofix fallback, optional format script
- commit-back to PR head branch only when diff exists

Safety controls:

- protected-path blocker rejects autofix changes touching security/audit/crypto/RBAC paths
- no trigger on `push` to `main`

### Tier 3 - fix proposal (draft PR only)

`fix-proposal.yml` runs:

- manually (`workflow_dispatch`) or
- automatically when `CI`/`verify` fails on `main` push (`workflow_run`)

Flow:

1. capture failing-before evidence (audit/tests/typecheck/tests)
2. attempt a proposal fix on a new branch
3. capture passing-after evidence
4. open a **draft** PR with evidence summary

Safety controls:

- never auto-merge
- if protected paths are touched, include `needs-human-review` label
- dedicated branch (`ci/fix-proposal/<run_id>`)

### Tier 4 - release (gated, reproducible, signed)

`release.yml`:

1. calls full verify gate
2. requires protected `release` environment approval
3. re-runs Rust tests
4. builds signed Tauri bundles (Linux/macOS/Windows)
5. uploads artifacts per OS

No source rewrite is performed in release jobs.

## Guardrails (cross-tier)

- verify paths never mutate source
- autofix runs only on PR branches
- no infinite loops (actor guard + workflow concurrency cancel)
- no retries/while-loops in workflows
- protected security/audit/crypto/RBAC paths are blocked from silent automation

## Notes

- `ci.yml` is retained as a wrapper entrypoint and delegates to reusable `verify.yml`.
- Package-manager detection is lockfile-based, not hardcoded to npm.
