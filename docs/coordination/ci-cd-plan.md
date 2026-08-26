# MeDoc CI/CD pipeline plan

## Scope

This plan defines a four-tier CI/CD model where verification gates merges and releases, deterministic formatting fixes are limited to PR branches, and non-deterministic fixes are proposed in draft PRs for human review.

## Verified workspace topology

- Rust workspace root: `Cargo.toml` with members under `apps/*` and `crates/*`.
- JS workspace root: `package.json` workspaces under `apps/*` and `packages/*`.
- Legacy monolithic CI workflow (`.github/workflows/ci.yml`) has been replaced with tiered workflows targeting the active workspace layout.

## Tier map

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | Blocking verify gate (fmt-check, clippy, tests, audit, lint, typecheck, test, build, axe-core critical a11y) |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | PR branch only | Deterministic formatting/lint auto-fix (`cargo fmt`, JS lint fix, optional format script), loop-guarded |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` (`workflow_run`) | New proposal branch + draft PR | Bounded substantive fix attempts with before/after evidence; never auto-merge |
| 4 | `.github/workflows/release.yml` | Tag `v*`, `workflow_dispatch` | No source edits | Re-run full verify on tagged commit, then signed cross-platform build in protected `release` environment |

## Guardrails implemented

1. **Verify never mutates:** `verify.yml` only runs check/test/audit commands.
2. **Autofix PR-only:** `autofix.yml` is `pull_request` only and never runs on `push`.
3. **Loop guard:** `autofix` job condition skips bot-authored reruns (`github.actor != 'github-actions[bot]'`).
4. **Deterministic Tier 2 only:** Tier 2 scope is formatting and lint auto-fix, then commit/push to PR head.
5. **Sensitive code escalation:** Tier 3 detects security/audit/crypto/RBAC path touches and applies `needs-human-review`.
6. **Terminable runs:** all jobs have explicit `timeout-minutes`; all workflows use `concurrency.cancel-in-progress`.
7. **Reproducible release path:** release job runs on tagged commit after verify gate and signs bundles without editing source.

## Notes on Tier 3 behavior

- Tier 3 captures failing-before and passing-after evidence logs and writes a report under `docs/coordination/ci-fix-proposals/`.
- Tier 3 opens a **draft** PR by design for human adjudication.
- If no code change is produced by bounded fix attempts, the report itself is committed so reviewers still receive evidence and rationale.
