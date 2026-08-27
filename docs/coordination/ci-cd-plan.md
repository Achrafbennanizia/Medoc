# MeDoc CI/CD pipeline plan

**Status:** implemented (2026-08-27)  
**Scope:** GitHub Actions workflows in `.github/workflows/`

## 1) Workspace detection and migration target

The active repository layout is:

- Rust workspace at repo root (`Cargo.toml`) with members under `apps/*` and `crates/*`
- JS workspace at repo root (`package.json`) with workspaces under `apps/*` and `packages/*`

Legacy `app/src-tauri` and `app/` CI assumptions were removed from the primary pipeline path by replacing the previous single `ci.yml` with tiered workflows.

## 2) Tier map

| Tier | Workflow | Trigger | Repo mutation |
| --- | --- | --- | :---: |
| Tier 1 verify | `.github/workflows/verify.yml` | `push` (main), `pull_request`, `workflow_call` | No |
| Tier 2 autofix | `.github/workflows/autofix.yml` | `pull_request` | Yes (PR branch only) |
| Tier 3 fix proposal | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, `workflow_run` (failed `verify` on `main`) | Yes (new proposal branch only) |
| Tier 4 release | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No source mutation |

## 3) Tier details

### Tier 1 — verify (blocking, zero mutation)

`verify.yml` runs:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: package-manager auto-detection (pnpm/yarn/npm), install, `lint` (no `--fix`), `typecheck`, `test`, `build`
- Accessibility: built UI scan with axe-core (`npm run test:a11y`) against WCAG 2.1 AA; critical violations fail

Guardrails:

- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`
- no `--fix` usage in verify jobs

### Tier 2 — autofix (PR branches only, deterministic)

`autofix.yml` runs on `pull_request` only:

- loop guard: `if: github.actor != 'github-actions[bot]'`
- deterministic-only fixes: `cargo fmt --all`, `lint:fix`, `format`
- commits back only to `${{ github.head_ref }}`

Safety controls:

- no execution for forked PR heads
- restricted path blocker for `security|audit|crypto|rbac` path touches
- no retries/loops beyond one run per PR head update

### Tier 3 — fix proposal (human-reviewed draft PRs)

`fix-proposal.yml` supports:

- manual dispatch with explicit `verify_command`, `fix_command`, and rationale
- auto-trigger when `verify` fails on `main` (`workflow_run`)
- always creates a **new branch**
- captures failing-before and passing-after evidence logs
- opens **draft PR only**

Safety controls:

- no auto-merge path
- if `security|audit|crypto|rbac` paths changed, apply `needs-human-review` label and fail job

Operational note:

- for automatic red-main attempts, define repository variable `CI_FIX_PROPOSAL_COMMAND` to point to the fix-agent command.

### Tier 4 — release (gated, reproducible, signed)

`release.yml`:

1. re-runs full verify via reusable workflow call (`uses: ./.github/workflows/verify.yml`)
2. builds signed bundles on Linux/Windows/macOS
3. requires protected `release` environment approval

Release guarantees:

- source tree is not rewritten in release path
- artifacts are built from the reviewed tag/dispatch commit
- signing uses `TAURI_SIGNING_PRIVATE_KEY` and password secrets

## 4) Required scripts wired for pipeline

To support tier execution:

- root `package.json` gained `typecheck`, `lint:fix`, `format`, `test:a11y` wrappers
- `apps/practice-host-ui/package.json` gained matching scripts
- `apps/practice-host-ui/scripts/test-a11y.mjs` performs the axe-core critical-violation gate

## 5) Remaining operator tasks

1. Ensure `release` environment protection rules require manual approval.
2. Configure `CI_FIX_PROPOSAL_COMMAND` if Tier 3 should auto-attempt fixes on red `main`.
3. Keep branch protection rules pointing at Tier 1 (`verify`) checks.
