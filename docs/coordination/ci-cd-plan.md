# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

Last updated: 2026-07-26

## Workspace detection (verified)

- Rust workspace root: `Cargo.toml` with members under `apps/` and `crates/`.
- JS workspace root: `package.json` workspaces under `apps/*` and `packages/*`.
- Legacy CI target (`.github/workflows/ci.yml`) has been replaced by tiered workflows anchored to the live workspace layout.

## Tier model

| Tier | Workflow | Trigger | Repository mutation |
| --- | --- | --- | --- |
| 1 | `verify.yml` | `push` on `main`, `pull_request`, `workflow_call` | No |
| 2 | `autofix.yml` | `pull_request` only | Yes (PR head branch only) |
| 3 | `fix-proposal.yml` | Manual dispatch, or failed `verify` on `main` push | No direct main mutation; opens draft PR branch |
| 4 | `release.yml` | Tag (`v*`) or manual dispatch | No source mutation (verify + signed build only) |

## Guardrails implemented

1. Verify jobs run non-mutating checks only.
2. Autofix is PR-only and blocked from bot recursion via actor loop guard.
3. Autofix uses deterministic format/lint commands (`cargo fmt`, `lint:fix`, `format`) and nothing logic-changing.
4. Fix proposals are always draft PRs on new branches and never auto-merged.
5. If fix proposals touch security/audit/crypto/RBAC paths, they are labeled `needs-human-review`.
6. Every workflow has timeout controls, and all long-lived tiers include `concurrency` cancellation.
7. Release is gated by full verify re-run and uses protected `release` environment approval before signed bundles.

## Validation hooks

- Tier 1 verifies Rust format/clippy/test/audit, JS lint/typecheck/test/build, and an axe-core critical WCAG 2.1 A/AA scan.
- Tier 2 pushes deterministic fixes to PR branch and relies on Tier 1 re-run for pass/fail.
- Tier 3 records failing-before/passing-after outcomes in draft PR body.
- Tier 4 re-runs Tier 1 gate before cross-platform signed artifact build/upload.
