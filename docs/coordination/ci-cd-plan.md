# MeDoc CI/CD plan — verify, safe auto-fix, gated release

**Status:** Implemented in `.github/workflows/{verify,autofix,fix-proposal,release}.yml`  
**Scope date:** 2026-09-26

## Workspace detection and migration outcome

The pipeline targets the current monorepo layout (not retired `app/src-tauri` paths):

- Rust workspace root `Cargo.toml` with members in `apps/*` and `crates/*`.
- JS workspace root `package.json` with packages in `apps/*`, `packages/*`, and `website/`.

Tier-1 checks execute from the repository root and call:

- Rust workspace commands (`cargo fmt`, `cargo clippy`, `cargo test`, `cargo audit`).
- Web package `medoc` commands in `apps/practice-host-ui` (`lint`, `typecheck`, `test`, `build`).

## Tier mapping

### Tier 1 — `verify.yml` (blocking, no mutation)

- **Triggers:** every `push`, every `pull_request`, and `workflow_call` (for release gate reuse).
- **Rules enforced:**
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
  - Package-manager detection from lockfile (`pnpm`, `yarn`, fallback `npm`)
  - JS lint/typecheck/test/build on workspace package `medoc`
  - Axe-core check against built preview UI; fail only on **critical** WCAG 2.1 AA violations
- **Safety controls:** per-job timeouts + `concurrency.cancel-in-progress`.

### Tier 2 — `autofix.yml` (PR branches only, deterministic fixes)

- **Trigger:** `pull_request` only.
- **Loop guard:** `if: github.actor != 'github-actions[bot]'`.
- **Deterministic fixers only:** `cargo fmt --all`, `lint:fix`, `format`.
- **Mutation scope:** pushes only to PR head branch in same repository.
- **Sensitive-code guard:** any changed path matching security/audit/crypto/RBAC is reverted before commit.

### Tier 3 — `fix-proposal.yml` (draft PR proposals, no auto-merge)

- **Triggers:** manual dispatch or failed `verify` on `main` (`workflow_run`).
- **Behavior:**
  - Creates a new proposal branch.
  - Captures failing-before and passing-after evidence logs.
  - Applies scripted fix attempts by failure class (`test_failure`, `security_advisory`, `type_error`, or `unknown`).
  - Opens a **draft** PR via `peter-evans/create-pull-request`.
- **Sensitive-code guard:** if diff touches security/audit/crypto/RBAC paths, label `needs-human-review` and stop workflow.
- **Explicitly prohibited:** auto-merge.

### Tier 4 — `release.yml` (gated release, zero source mutation)

- **Triggers:** tag `v*` or manual dispatch.
- **Gate:** reuses `verify.yml` via `workflow_call`.
- **Approval:** protected GitHub environment `release`.
- **Build:** matrix on Linux/Windows/macOS; signed Tauri bundles using
  `TAURI_SIGNING_PRIVATE_KEY` + password.
- **Output:** uploaded signed artifacts from the tagged commit.

## Global guardrails implemented

1. Verify path does not run mutating flags.
2. Auto-fix cannot run on protected branch push events.
3. Loop-prevention for auto-fix bot commits.
4. Sensitive domains (security/audit/crypto/RBAC) blocked from unattended mutation paths.
5. All jobs have explicit timeout limits; workflows use concurrency cancellation.
6. Release path is verify-first, approval-gated, and signed.
