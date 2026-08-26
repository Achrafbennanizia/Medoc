# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

Last updated: 2026-08-26

## Workspace detection and migration scope

- Rust workspace is rooted at `/workspace/Cargo.toml` and includes `apps/practice-host` plus `crates/*` members.
- JavaScript workspace is rooted at `/workspace/package.json` and includes `apps/*` and `packages/*` workspaces.
- Legacy `.github/workflows/ci.yml` has been retired and replaced by tiered workflows against the live workspace layout.

## Tier map

| Tier | Workflow | Trigger | Mutates repo? | Notes |
| --- | --- | --- | :---: | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking gate; concurrency cancellation + per-job timeout |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | Yes (PR branch only) | Deterministic fixes only; bot loop guard |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | No direct main/release mutation | Creates draft PR from a new branch with evidence |
| 4 | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No | Re-runs full verify then builds signed artifacts in protected `release` env |

## Tier 1 — verify (blocking, no mutation)

`verify.yml` runs:

- Rust: `cargo fmt --check`, clippy with `-D warnings`, workspace tests, `cargo audit`.
- Web: package-manager detection (pnpm/yarn/npm), install, lint (no `--fix`), explicit TypeScript typecheck, tests, build.
- Accessibility: built UI preview + `axe-core` scan for WCAG 2.1 A/AA and hard-fail on **critical** impact violations.

Guardrails:

- No `--fix` in verify jobs.
- `concurrency.cancel-in-progress: true`.
- Job timeouts for termination guarantees.

## Tier 2 — auto-fix (PR branches only)

`autofix.yml` constraints:

- Triggered only by `pull_request` events.
- Loop guard: skips when actor is `github-actions[bot]`.
- Never runs for fork PRs (write-protection guard).
- Deterministic-only fixes:
  - `cargo fmt --all`
  - `lint:fix` (or `lint -- --fix` fallback)
  - `format` when present
- Commits and pushes only to the PR head branch.

## Tier 3 — fix proposal (draft PR only)

`fix-proposal.yml` behavior:

- Trigger:
  - Manual dispatch, or
  - Automatic when `verify` fails on `main` (`workflow_run`).
- Attempts a real fix via configured agent command:
  - dispatch input `agent_command`, or
  - repo variable `CI_FIX_PROPOSAL_COMMAND`.
- Collects before/after evidence (`cargo test`, `cargo audit`, `typecheck`) and uploads logs as artifacts.
- Requires code changes to proceed.
- Opens a **draft** PR on a new branch (`ci/fix-proposal-<run-id>-<attempt>`).
- Sensitive path guard: if diff paths include `security`, `audit`, `crypto`, or `rbac`, label with `needs-human-review` and stop automation.

## Tier 4 — release (gated, reproducible, signed)

`release.yml` behavior:

1. Re-runs full tier-1 verify on the exact tag/dispatch commit via reusable workflow call.
2. Builds signed artifacts on Linux/Windows/macOS.
3. Runs in protected `release` environment (manual approval gate).
4. Uploads bundle artifacts from `apps/practice-host/target/release/bundle/**/*`.

No source mutation occurs in release jobs.

## Global guardrails implemented

1. Verify pipeline does not mutate source.
2. Auto-fix is limited to PR branches and deterministic formatting/lint operations.
3. Loop prevention for bot-authored commits in auto-fix.
4. Non-deterministic fixes route through draft PR proposals (human merge decision).
5. Sensitive-code proposals are explicitly labeled for human review.
6. Every workflow tier has timeout + concurrency controls to avoid runaway runs.
7. Release path is verify-first, signed, and environment-gated.
