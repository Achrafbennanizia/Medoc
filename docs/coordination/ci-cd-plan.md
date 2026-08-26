# MeDoc CI/CD pipeline plan

**Scope:** GitHub Actions workflows under `.github/workflows/`  
**Stack:** Tauri 2 + Rust workspace (`apps/*`, `crates/*`) + JS workspace (`apps/*`, `packages/*`)  
**Status:** Implemented reference pipeline (verify + autofix + fix-proposal + release)

---

## 1) Core rule

Release gates verify; they do not mutate source.

- **Verify** jobs fail or pass without changing the repository.
- **Auto-fix** mutates only PR head branches, only for deterministic formatting/linting changes.
- **Fix proposals** for non-deterministic failures are raised as draft PRs on new branches for human review.
- **Release** rebuilds and signs the tagged commit under manual approval; no source mutation.

---

## 2) Workspace detection and migration

The active workspace is the repo-root Cargo/npm workspace:

- Rust: root `Cargo.toml` workspace members include `apps/practice-host`, `crates/*`
- JS: root `package.json` workspaces include `apps/practice-host-ui`, `apps/lan-web-client`, `packages/*`

Pipeline migration applied:

- Retired `.github/workflows/ci.yml` replaced by tiered workflow set.
- Canonical verify gate is now `.github/workflows/verify.yml`.

---

## 3) Pipeline tiers

| Tier | Workflow | Trigger | Mutates repo | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | no | blocking quality/security/accessibility gate |
| 2 | `autofix.yml` | `pull_request` only | yes (PR branch only) | deterministic safe fixes (`cargo fmt`, lint/format fixes) |
| 3 | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | no direct mutation to protected branches; opens draft PR | non-deterministic fix proposal on a new branch |
| 4 | `release.yml` | tag `v*` or manual dispatch | no | re-verify tagged commit, signed cross-platform bundles in protected `release` environment |

---

## 4) Guardrails

1. **Verify jobs never mutate source**
   - `cargo fmt --check`, lint without `--fix`, tests/build/audit only.
2. **Auto-fix never runs on protected/release paths**
   - `autofix.yml` is `pull_request` only, with bot loop guard.
3. **Loop prevention**
   - `if: github.actor != 'github-actions[bot]'` stops bot-triggered fix loops.
4. **Deterministic fixes only**
   - Tier 2 limited to formatter/linter class edits; no logic changes.
5. **Compliance-sensitive files are escalation-only in tier 3**
   - `fix-proposal.yml` detects edits under security/audit/crypto/RBAC paths, applies `needs-human-review`, and stops.
6. **Terminable runs**
   - All jobs include explicit timeouts; workflows use concurrency cancellation.
7. **Release reproducibility**
   - `release.yml` gates on `verify`, builds signed artifacts from the tagged commit, uploads artifacts, emits checksums, and attaches provenance attestations.

---

## 5) Workflow summary

### Tier 1 — `verify.yml` (blocking, zero mutation)

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lockfile-based PM detection (`pnpm`/`yarn`/`npm`), install, lint, typecheck, test, build
- A11y: builds web UI and runs `@axe-core/cli` against served output; fails on **critical WCAG 2.1 A/AA** findings

### Tier 2 — `autofix.yml` (PR branches only)

- Runs deterministic fixes:
  - `cargo fmt --all`
  - JS lint fix / format scripts in `apps/practice-host-ui`
- Commits back only when diff exists and pushes to PR head branch.

### Tier 3 — `fix-proposal.yml` (draft PR proposal flow)

- Triggered manually or when `verify` fails on `main`.
- Creates a fresh proposal branch.
- Runs configurable agent command (`CI_FIX_AGENT_COMMAND` in repo secret/variable).
- Opens a **draft PR** with rationale + evidence scaffold.
- If changed paths match security/audit/crypto/RBAC patterns:
  - add `needs-human-review`
  - stop the workflow (no auto-merge path).

### Tier 4 — `release.yml` (gated, signed, non-mutating)

- Calls `verify.yml` as reusable gate for the tagged commit.
- Uses protected `release` environment (manual approval gate).
- Matrix builds on Linux/Windows/macOS.
- Runs Rust tests again on release commit, configures updater metadata, builds signed Tauri bundles.
- Publishes bundle artifacts + `SHA256SUMS.txt` + provenance attestations.

---

## 6) Operational notes

- Ensure the `release` environment is configured as protected with required approvers.
- Tier 3 needs a configured command in `CI_FIX_AGENT_COMMAND` (repo secret/variable) to run an actual fixing agent.
- Branch protection should require successful `verify` before merge.

---

## 7) Paste-ready agent prompt (tier 3 operator)

Use this prompt value for `CI_FIX_AGENT_COMMAND` integrations or external agent invocation:

> Analyze the failing `verify` gate evidence for this commit and apply the smallest safe fix on the current proposal branch. Keep fixes deterministic where possible, avoid speculative refactors, and include failing-before/passing-after evidence in `.ci/fix-proposal-evidence.md`. Never auto-merge. If your diff touches security, audit, crypto, or RBAC code, state that explicitly in the evidence file for mandatory human review.
