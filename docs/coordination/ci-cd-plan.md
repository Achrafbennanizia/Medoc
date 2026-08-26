# MeDoc CI/CD pipeline plan

**Last updated:** 2026-08-26  
**Scope:** Verify-first CI/CD with constrained PR-branch autofix and draft fix proposals.

## Verified workspace model

- **Rust workspace root:** `Cargo.toml` at repository root.
- **Rust members:** `apps/practice-host`, `crates/*` (see root `Cargo.toml` `[workspace].members`).
- **JavaScript workspace root:** `package.json` at repository root.
- **JS workspaces:** `apps/*`, `packages/*` (see root `package.json` `workspaces` array).

## Pipeline tiers

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | **No** | Blocking quality/security/accessibility verification |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | **Yes (PR head branch only)** | Deterministic autofix (`cargo fmt`, lint/format scripts) |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, red `main` via `workflow_run` from `verify` | **Yes (new proposal branch only)** | Draft PR proposal flow for substantive fixes with before/after evidence |
| 4 | `.github/workflows/release.yml` | Tag `v*`, `workflow_dispatch` | **No source mutation** | Re-verify, then signed cross-platform artifacts behind protected `release` environment |

## Guardrails

1. **Verify never mutates source**
   - Tier 1 runs check-only commands (`cargo fmt --check`, clippy `-D warnings`, tests, audit, lint/typecheck/test/build, a11y smoke).
2. **Autofix is PR-only**
   - Tier 2 runs only on `pull_request`, never on `push main` or release.
3. **Loop guard for autofix**
   - Tier 2 job condition blocks `github-actions[bot]` re-entry.
4. **Deterministic-only in Tier 2**
   - `cargo fmt` + lint/format scripts only; no logic-changing commands in this workflow.
5. **Sensitive path escalation**
   - Tier 3 checks changed file paths for `security|audit|crypto|rbac`, adds `needs-human-review`, and hard-stops.
6. **Terminating runs**
   - Concurrency cancellation + per-job timeouts on all workflows.
7. **Release reproducibility**
   - Tier 4 calls Tier 1 gate first, builds signed artifacts from the tagged commit, and checks source tree stays unchanged (`git diff --exit-code`).

## Tier details

### Tier 1 — verify (`verify.yml`)

- Rust: fmt check, clippy deny warnings, workspace tests, cargo audit.
- Web: package-manager detection by lockfile (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`) and lint/typecheck/test/build.
- A11y: `test:a11y` smoke using `axe-core`, with critical WCAG 2.1 AA violations treated as failures.

### Tier 2 — autofix (`autofix.yml`)

- Scope: only PR branches from this repository (not forks).
- Commands:
  - `cargo fmt --all`
  - `lint:fix` and `format` scripts (best-effort; deterministic only)
- On diff: commit back to PR head branch with CI bot identity.

### Tier 3 — fix proposal (`fix-proposal.yml`)

- Triggered manually or when `verify` fails on `main`.
- Creates a fresh `ci/fix-proposal-*` branch, runs:
  - failing-before verification command
  - configurable fix command
  - passing-after verification command
- Opens a **draft PR** with:
  - rationale/context
  - before/fix/after exit codes
  - changed-file list
  - attached logs as workflow artifacts
- Fix command resolution priority:
  1. `workflow_dispatch` input `fix_command`
  2. repository variable `CI_FIX_PROPOSAL_COMMAND`
  3. unset (workflow stops with no PR if no diff is produced)

### Tier 4 — release (`release.yml`)

- Calls Tier 1 (`uses: ./.github/workflows/verify.yml`) as a required gate.
- Builds signed artifacts on Linux/macOS/Windows in protected `release` environment.
- Uploads build bundles as workflow artifacts.
- No formatter or fix command runs in release path.

## Operational notes

- The historical `.github/workflows/ci.yml` has been replaced by tiered workflows above.
- Root npm scripts now expose CI-oriented commands used by workflows:
  - `typecheck`, `lint:fix`, `format`, `test:a11y`.
