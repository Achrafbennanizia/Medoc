# MeDoc CI/CD pipeline plan

Last updated: 2026-08-26

## 1) Workspace reality (verified)

- Rust workspace root: `Cargo.toml` with members in `apps/*` and `crates/*`.
- JS workspace root: `package.json` with workspaces in `apps/*` and `packages/*`.
- Active workflow set:
  - `verify.yml` (Tier 1, blocking, zero mutation)
  - `autofix.yml` (Tier 2, pull_request only, deterministic branch-local fixes)
  - `fix-proposal.yml` (Tier 3, draft proposal PRs for non-deterministic failures)
  - `release.yml` (Tier 4, gated release build from tagged commit)

## 2) Tier model

| Tier | Trigger | Repo mutation | Goal |
| --- | --- | --- | --- |
| Tier 1 verify | `push` to `main`, `pull_request` | No | Gate merges with format/check/test/build/audit/a11y |
| Tier 2 autofix | `pull_request` | Yes (PR branch only) | Apply deterministic formatting/lint fixes and push once |
| Tier 3 fix-proposal | `workflow_dispatch` or failed verify on `main` | No direct main mutation (draft PR only) | Attempt substantive remediations and open reviewable proposal |
| Tier 4 release | `push` tag `v*` or manual dispatch | No | Re-verify tagged commit, then build signed artifacts behind approval gate |

## 3) Guardrails

1. Verify workflows never run with `--fix` mutations.
2. Autofix only runs on PR head branches and is blocked for bot-authored loops.
3. Autofix rejects any change touching security/audit/crypto/RBAC paths.
4. Fix-proposal always opens draft PRs (never auto-merge) on a new branch.
5. Fix-proposal labels compliance-sensitive diffs with `needs-human-review` and stops.
6. All jobs have explicit timeouts and workflow concurrency cancellation.
7. Release runs in protected `release` environment and signs artifacts from the exact tagged commit.

## 4) Tier implementation summary

### Tier 1 `verify.yml`

- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS checks:
  - package manager auto-detected from lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`)
  - `lint`, `typecheck`, `test`, `build` on workspace `medoc`
- Accessibility:
  - build + preview UI
  - `test:a11y` (`axe-core` + Playwright) fails on critical WCAG 2.1 AA violations

### Tier 2 `autofix.yml`

- Trigger: `pull_request` only
- Loop guard: `if: github.actor != 'github-actions[bot]'`
- Deterministic fixes:
  - `cargo fmt --all`
  - JS `lint:fix` and `format`
- Branch-only push with bot identity after guarded change detection

### Tier 3 `fix-proposal.yml`

- Trigger:
  - manual dispatch
  - failed `verify` run on `main` (`workflow_run`)
- Remediation attempt script: `scripts/ci/fix-proposal-attempt.sh`
  - records failing-before and passing-after evidence
  - currently attempts dependency refresh (`cargo update --workspace`) when audit fails
- Opens a draft PR on `ci/fix-proposal-<run_id>` with report body
- Compliance-sensitive changes get `needs-human-review` label and hard stop

### Tier 4 `release.yml`

- Trigger: tag `v*` or manual dispatch
- `gate` job reuses `verify.yml` on tagged commit
- `build` matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`
- Protected environment: `release` (manual approval point)
- Build step runs tests, then `tauri build` with signing secrets
- Uploads bundled artifacts and attaches provenance attestation

## 5) Operational notes

- Branch protection should require successful Tier 1 `verify` status checks.
- Keep release environment approvals enabled and limited to release owners.
- Keep `needs-human-review` as a protected label in review policy.
