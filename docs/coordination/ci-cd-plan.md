# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

## Scope

- **Rust workspace:** `Cargo.toml` members under `apps/*` and `crates/*`
- **JS workspace:** npm/yarn/pnpm workspaces under `apps/*` and `packages/*`
- **Workflows:** `.github/workflows/{verify,autofix,fix-proposal,release}.yml`

## Tier model

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | Blocking verification for Rust + JS + accessibility |
| 2 | `autofix.yml` | `pull_request` only | Yes (PR head branch only) | Deterministic formatting/lint fixes (`cargo fmt`, eslint fix/format) |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | Yes (new branch only) | Draft PR proposal with before/after evidence for non-deterministic fixes |
| 4 | `release.yml` | tag `v*`, `workflow_dispatch` | No | Re-run verify, then signed cross-platform artifacts under protected `release` environment |

## Guardrails

1. **Verify never mutates source.**
2. **Autofix never runs on protected/release paths.** It is `pull_request` only and includes bot loop guard.
3. **Deterministic-only auto-fix.** Tier 2 is limited to formatting/lint edits.
4. **Compliance path protection.** Security/audit/crypto/RBAC file changes are blocked in Tier 2 and labeled for human review in Tier 3.
5. **Terminating runs.** Every job has explicit timeout and uses `concurrency.cancel-in-progress`.
6. **Release reproducibility.** Tier 4 verifies the tagged commit, then signs artifacts without mutating source.

## Workspace command mapping

### Rust (Tier 1 gate)

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace --tests`
- `cargo audit`

### JS (Tier 1 gate)

Package manager is detected from lockfile (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`) and then:

- `medoc` lint/test/build/typecheck
- `medoc-lan-web-client` typecheck/build
- no `--fix` in verify tier

### Accessibility (Tier 1 gate)

- `apps/practice-host-ui/scripts/test-a11y-critical.mjs`
- scans built UI with axe-core tags `wcag2a` + `wcag2aa`
- fails on **critical** violations

## Tier-3 operational note

`fix-proposal.yml` executes `MEDOC_FIX_PROPOSAL_COMMAND` when configured as a repository variable, then opens a **draft PR** with:

- failing-before evidence
- passing-after evidence (or **NOT RUN** when stopped by compliance guard)
- rationale in `docs/coordination/fix-proposals/fix-proposal-<run-id>.md`
