# MeDoc CI/CD plan — verify, safe auto-fix, gated release

**Status:** Implemented in `.github/workflows/{verify,autofix,fix-proposal,release}.yml`  
**Scope:** Tauri 2 + Rust workspace (`crates/*`, `apps/*`) + JS workspace (`apps/*`, `packages/*`)

## Core rule

Release gates verify; they do not mutate source. The shipped artifact must be built from the reviewed/tagged commit without workflow-side source edits.

## Workspace truth used by CI

- Rust workspace root: `Cargo.toml` at repository root with members under `apps/` + `crates/`.
- JS workspace root: `package.json` at repository root with npm workspaces under `apps/` + `packages/`.
- Package manager is detected from lockfiles (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`) at runtime.

## Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:
- `push` to `main`
- `pull_request`
- `workflow_call` (for release gate reuse)

Jobs (all with timeout + concurrency cancellation):
- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`
- Web: install via detected package manager, then `lint`, `typecheck`, `test`, `build`
- A11y: build UI, run axe-core (`wcag2aa`, `wcag21aa`) and fail on **critical** violations

## Tier 2 — `autofix.yml` (PR branches only)

Trigger:
- `pull_request` only (never `push` to `main`, never release)

Guards:
- Loop guard: skip bot actor (`github-actions[bot]`)
- Same-repository PR head only (no fork writes)
- Deterministic fixes only (`cargo fmt`, `lint:fix`, `format`)

Behavior:
- If fixes change files, commit to PR head branch and push once.
- Verify re-runs on the updated commit.

## Tier 3 — `fix-proposal.yml` (draft proposal, never auto-merge)

Triggers:
- Manual `workflow_dispatch`
- Failed `verify` on `main` via `workflow_run`

Behavior:
- Creates a **new branch** (`ci/fix-proposal-<run_id>`)
- Captures failing-before and passing-after evidence logs
- Attempts best-effort remediation based on failure class
- Opens a **draft PR** with diff + rationale + evidence

Sensitive-path guard:
- If diff touches security/audit/crypto/RBAC paths (or `config/rbac.yaml`), apply label `needs-human-review` and stop automation.

## Tier 4 — `release.yml` (gated, signed, non-mutating)

Triggers:
- Tag push `v*`
- Manual `workflow_dispatch`

Flow:
1. `gate` job re-runs full verify on the tagged commit (`uses: ./.github/workflows/verify.yml`)
2. `build` matrix (`ubuntu`, `windows`, `macos`) runs under protected `release` environment (manual approval)
3. Build signed Tauri bundles using signing secrets; upload artifacts

Guarantees:
- No source rewrite on release path
- Manual release approval point (`environment: release`)
- Reproducible build path from tag/dispatch commit

