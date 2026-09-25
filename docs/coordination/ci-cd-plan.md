# MeDoc CI/CD pipeline plan (verify + safe autofix + gated release)

## Goal

The pipeline verifies code quality and release integrity without mutating protected paths.  
Automation is split into four explicit tiers so deterministic hygiene can be automated while substantive fixes stay human-reviewed.

## Workspace detection (implemented)

- **Rust workspace root:** `Cargo.toml` at repo root with members under `apps/*` and `crates/*`.
- **JS workspace root:** `package.json` at repo root with workspaces in `apps/*`, `packages/*`, and `website`.
- **Legacy path migration:** old monolithic CI file (`.github/workflows/ci.yml`) is retired in favor of tiered workflows targeting the live workspace.

## Tier map

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` (`main`) + `pull_request` + `workflow_call` | No | Blocking verification for Rust + JS + a11y |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | Yes (PR head branch only) | Deterministic fixes only (`cargo fmt`, lint/format fix) |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | Yes (new branch + draft PR) | Agent-assisted fix proposal with before/after evidence |
| 4 | `.github/workflows/release.yml` | tag `v*` or dispatch | No source mutation | Re-verify, then signed cross-platform bundles behind manual approval |

## Guardrails implemented

1. **Verify is read-only:** no `--fix` flags in Tier 1 jobs.
2. **Autofix is PR-only:** Tier 2 cannot run on `push` to `main`.
3. **Loop guard:** Tier 2 skips `github-actions[bot]` actor to prevent fix loops.
4. **Deterministic scope:** Tier 2 only runs formatter/lint auto-fixes.
5. **Compliance-sensitive protection:** changes touching `security`/`audit`/`crypto`/`rbac` are blocked in Tier 2; Tier 3 labels such proposals `needs-human-review` and stops.
6. **Termination controls:** all jobs include `timeout-minutes`; workflow concurrency cancels superseded runs.
7. **Release reproducibility:** Tier 4 re-runs Tier 1 gates on tagged code and builds signed artifacts in protected `release` environment.

## Operational notes

- Package manager is auto-detected from lockfiles (`pnpm-lock.yaml`, `yarn.lock`, otherwise `package-lock.json`).
- Accessibility gate runs axe-core WCAG 2.1 AA checks and fails only on **critical** violations.
- Tier 3 supports repository-level defaults via:
  - `CI_FIX_PROPOSAL_COMMAND`
  - `CI_FIX_PROPOSAL_VERIFY_COMMAND`

