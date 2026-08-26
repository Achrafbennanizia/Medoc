# MeDoc CI/CD plan (verify + safe autofix + gated release)

Last updated: 2026-08-26

## Verified workspace layout

- Rust workspace root: `/workspace/Cargo.toml`
  - Members include `apps/practice-host`, `crates/*`, `packages/*`-adjacent TS consumers.
- JS workspace root: `/workspace/package.json`
  - Workspaces include `apps/practice-host-ui`, `apps/lan-web-client`, `packages/*`.
- Lockfile observed: `package-lock.json` (npm), with workflow-level detection for pnpm/yarn fallback.

## Tier map

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `.github/workflows/verify.yml` | `push` to `main`, `pull_request` | No | Blocking verification: Rust fmt/clippy/test/audit, web lint/typecheck/test/build, axe-core a11y gate |
| 2 | `.github/workflows/autofix.yml` | `pull_request` only | Yes (PR head branch only) | Deterministic fixes only (`cargo fmt`, lint autofix, optional format script), then push to PR branch |
| 3 | `.github/workflows/fix-proposal.yml` | Manual dispatch, or failed `verify` on `main` | No direct protected-branch mutation | Create a **draft PR** from fix attempt with rationale + failing-before/passing-after evidence |
| 4 | `.github/workflows/release.yml` | Tag `v*` or manual dispatch | No | Re-run full verify, then signed cross-platform builds in protected `release` environment |

## Guardrails implemented

1. **Verify does not mutate source**
   - `verify.yml` runs check-only and build/test/audit commands.
2. **Autofix restricted to PR heads**
   - `autofix.yml` uses `on: pull_request` and `if: github.actor != 'github-actions[bot]'`.
3. **Loop guard for bot commits**
   - Bot-authored follow-up events are skipped by autofix.
4. **Deterministic autofix scope**
   - Only formatter/linter-style fixes in tier 2.
5. **Sensitive area stop in fix proposals**
   - Tier 2 refuses to commit if deterministic fixes touch paths matching `security|audit|crypto|rbac`.
   - Tier 3 detects touched sensitive paths, applies `needs-human-review`, and fails the run to halt automation.
6. **Terminating runs**
   - Concurrency cancellation + per-job timeouts across all workflows.
7. **Release reproducibility gate**
   - `release.yml` calls `verify.yml` first (`gate` job), then builds from that commit without source edits.
8. **Release approval gate**
   - Cross-platform build job runs in protected environment `release` for manual approval.

## Migration note

- Legacy `.github/workflows/ci.yml` was removed and replaced with tiered workflows centered on `verify.yml`.
