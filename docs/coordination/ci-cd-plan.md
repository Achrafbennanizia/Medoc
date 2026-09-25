# MeDoc CI/CD pipeline plan (verify-first, guarded automation)

**Last updated:** 2026-09-25  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Goals

1. Keep release artifacts reproducible from reviewed commits.
2. Separate verify, deterministic auto-fix, substantive fix proposals, and release.
3. Prevent automation from mutating protected/release paths.
4. Migrate away from stale legacy CI assumptions and align with the live workspace:
   - Rust workspace at repo root (`apps/*`, `crates/*`)
   - JS workspace at repo root (`apps/*`, `packages/*`)

## Tier map

| Tier | Workflow | Trigger | Repo mutation |
|---|---|---|---|
| 1 | `verify.yml` | push + pull_request (+ `workflow_call`) | No |
| 2 | `autofix.yml` | pull_request | Yes, PR head branch only |
| 3 | `fix-proposal.yml` | manual dispatch or failed `verify` on `main` push | Yes, on a new draft-PR branch |
| 4 | `release.yml` | tag `v*` or manual dispatch | No source mutation |

## Tier 1 — verify (`.github/workflows/verify.yml`)

- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS checks:
  - Package manager auto-detected from lockfile (`pnpm`, `yarn`, or `npm`)
  - `lint` (no `--fix`)
  - `typecheck`
  - `test`
  - `build`
- Accessibility:
  - Runs axe-core against built UI via `apps/practice-host-ui/scripts/run-axe-critical-check.mjs`
  - Fails on critical WCAG 2.1 AA violations.
- Guardrails:
  - `concurrency.cancel-in-progress: true`
  - per-job timeouts
  - no mutation steps

## Tier 2 — deterministic auto-fix (`.github/workflows/autofix.yml`)

- Runs on PR events only.
- Explicit loop guard:
  - skips bot-triggered reruns (`github.actor != 'github-actions[bot]'`)
- Deterministic-only commands:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Commits only when diff exists, then pushes to PR head branch.
- Never runs on `push` to `main` or release workflows.

## Tier 3 — substantive fix proposal (`.github/workflows/fix-proposal.yml`)

- Triggers:
  - Manual (`workflow_dispatch`)
  - Failed `verify` run on `main` push (`workflow_run`)
- Runs a fix-attempt script:
  - `scripts/ci/fix-proposal-attempt.sh`
  - Captures failing-before/passing-after evidence.
  - Attempts substantive remediation (`cargo fix`, dependency advisory updates).
- Opens a **draft PR** on a new branch (`ci/fix-proposal-<run-id>`).
- Sensitive-scope detection:
  - if changed files match security/audit/crypto/RBAC patterns, label PR with `needs-human-review` and stop the workflow with a blocking status.

## Tier 4 — release gate (`.github/workflows/release.yml`)

- Triggered by `v*` tag or manual dispatch.
- First job calls Tier 1 verify as a reusable workflow (`workflow_call`) on the exact release ref.
- Build job:
  - matrix: linux / macOS / windows
  - protected environment: `release` (manual approval gate)
  - verifies again (`cargo test --workspace`) and builds signed Tauri bundles
  - uploads artifacts from `apps/practice-host/target/release/bundle/**/*`
- No source mutation in release path.

## Compatibility note

- `.github/workflows/ci.yml` is retained as a manual `workflow_dispatch` compatibility shim (`ci-compat`) that delegates to `verify.yml`.
- This removes stale monolithic CI logic while preserving a familiar manual entrypoint.
