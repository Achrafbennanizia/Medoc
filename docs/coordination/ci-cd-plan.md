# MeDoc CI/CD plan — verify, safe auto-fix, gated release

**Last updated:** 2026-09-26  
**Scope:** `.github/workflows/{verify,autofix,fix-proposal,release}.yml`

## Workspace truth used by CI/CD

- Rust workspace root is `Cargo.toml` at repository root with members under `apps/*` and `crates/*`.
- JS workspace root is `package.json` with workspaces under `apps/*`, `packages/*`, `website`.
- Legacy workflow pathing in historical CI references has been replaced by workspace-root commands and lockfile-based package-manager detection.

## Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:
- `push` on `main`
- `pull_request`
- `workflow_call` (for release reuse)

Jobs:
- **rust**: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- **web**: detect lockfile (`pnpm`/`yarn`/`npm`), install deps, run `medoc` workspace `lint`, `typecheck`, `test`, `build`
- **a11y**: build `medoc` UI, run axe-core check (`test:a11y`) and fail on any critical WCAG 2.1 A/AA violation

Guardrails:
- `concurrency.cancel-in-progress: true`
- per-job timeouts
- no `--fix` or source mutation commands

## Tier 2 — `autofix.yml` (PR branches only, deterministic fixes)

Trigger:
- `pull_request` only

Safety constraints:
- loop guard: `github.actor != 'github-actions[bot]'`
- same-repo PR heads only (`github.event.pull_request.head.repo.full_name == github.repository`)
- deterministic-only commands: `cargo fmt`, `lint:fix`, `format`
- commits back to PR head only if tree changed

## Tier 3 — `fix-proposal.yml` (draft PR proposals, never auto-merge)

Trigger:
- `workflow_dispatch`
- `workflow_run` when `verify` fails on `main`

Behavior:
- checks out failing ref (or selected base ref)
- captures failing-before evidence
- runs a configurable non-deterministic fix command via repo variable `MEDOC_FIX_PROPOSAL_COMMAND`
- captures after-verification evidence (`.github/scripts/verify-local.sh`)
- opens a **draft** PR with changed files and evidence summary
- if changed paths match `(security|audit|crypto|rbac)`, applies `needs-human-review` label and stops

## Tier 4 — `release.yml` (tag/dispatch, gated, reproducible)

Trigger:
- `push` tags `v*`
- `workflow_dispatch`

Flow:
1. **gate** reuses `verify.yml` on the tagged commit
2. **build** runs under protected `release` environment (manual approval), re-runs `cargo test --workspace`, then builds signed Tauri bundles on Linux/macOS/Windows
3. Uploads signed artifacts only; source is never edited in release path

## Legacy workflow compatibility

- `.github/workflows/ci.yml` is now a lightweight alias that calls `verify.yml` via `workflow_call`/`workflow_dispatch`.
- Primary merge gate should use checks from `verify.yml`.
