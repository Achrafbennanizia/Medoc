# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Scope

- Rust workspace: repo-root `Cargo.toml` members under `apps/*`, `crates/*`, `installer/*`
- JavaScript workspace: repo-root `package.json` workspaces under `apps/*`, `packages/*`, `website`
- CI runtime: GitHub Actions workflows in `.github/workflows/`

## Migration summary

- Retired monolithic CI logic in `.github/workflows/ci.yml` was replaced by a manual legacy shim.
- Active tiered workflows now live in:
  - `.github/workflows/verify.yml` (tier 1)
  - `.github/workflows/autofix.yml` (tier 2)
  - `.github/workflows/fix-proposal.yml` (tier 3)
  - `.github/workflows/release.yml` (tier 4)
- No workflow assumes legacy `app/` or `app/src-tauri` roots; commands target the live workspace.

## The governing rule

Release gates verify artifacts from reviewed commits. They do not mutate source:

1. Verify jobs pass/fail without writing.
2. Autofix writes are limited to deterministic format/lint changes and PR heads only.
3. Non-deterministic fixes are proposed in draft PRs for human review.
4. Release re-verifies and signs only.

## Tier model

| Tier | Workflow | Trigger | Mutates repo | Purpose |
|---|---|---|---|---|
| 1 | `verify.yml` | `push` to `main`, `pull_request`, reusable `workflow_call` | No | Blocking gate for fmt/clippy/tests/audit + web lint/typecheck/test/build + axe-core critical WCAG 2.1 AA check |
| 2 | `autofix.yml` | `pull_request` | Yes (PR head branch only) | Deterministic autofix (`cargo fmt`, lint autofix, optional `format`) with loop guard |
| 3 | `fix-proposal.yml` | manual dispatch or failed `verify` on `main` | Yes (new draft PR branch only) | Captures failing-before/passing-after evidence, attempts non-deterministic remediation, opens draft PR |
| 4 | `release.yml` | tag push (`v*`, `version*`) or manual dispatch | No | Calls tier-1 verify on tagged commit, then builds signed cross-platform bundles in protected `release` environment |

## Guardrails implemented

1. **Verify is immutable**: no `--fix` and no commit/push steps in `verify.yml`.
2. **Autofix is PR-only**: `autofix.yml` runs on `pull_request` with actor loop guard and same-repo guard.
3. **Loop prevention**: autofix skips bot-authored runs (`github.actor != 'github-actions[bot]'`).
4. **Deterministic-only autofix**: `cargo fmt`, lint autofix, optional repo-defined formatter.
5. **Sensitive-code escalation in fix proposals**:
   - If proposal touches paths matching `security|audit|crypto|rbac|auth|permission`, workflow labels PR `needs-human-review` and stops intentionally.
6. **Termination controls**:
   - `concurrency.cancel-in-progress: true`
   - explicit per-job `timeout-minutes`
7. **Release reproducibility**:
   - release workflow calls `verify.yml` via `workflow_call`
   - build job runs under protected `environment: release`
   - source tree is never committed/pushed from release jobs

## Notes for operators

- Tier 3 is intentionally draft-only and never auto-merges.
- Tier 3 keeps a markdown evidence report under `.github/fix-proposals/`.
- Branch protection should point at `verify` checks (and release approval policy should be enforced via the `release` environment).
