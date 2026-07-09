# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-09  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Verified workspace model

- **Rust workspace root:** `Cargo.toml` at repository root with members in `apps/practice-host`, `crates/*` (app/server/shared/test).
- **JS workspace root:** `package.json` at repository root with workspaces in `apps/*` and `packages/*`.
- **Legacy path issue resolved:** the retired single-app `ci.yml` workflow was replaced with workspace-aware tiered workflows.

## Tier overview

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, reusable `workflow_call` | **No** | Blocking verification for Rust, web, and accessibility checks |
| 2 | `autofix.yml` | `pull_request` only | **Yes (PR head branch only)** | Deterministic `cargo fmt`, `lint:fix`, `format` autofixes |
| 3 | `fix-proposal.yml` | Manual dispatch or failed `verify` on `main` push | **Yes (new proposal branch only)** | Bounded fix attempt and draft PR with evidence |
| 4 | `release.yml` | Tag `v*` or manual dispatch | **No** | Re-run verify, then signed cross-platform artifacts behind protected `release` environment |

## Guardrails

1. **Verify never mutates source.**
2. **Auto-fix is PR-only** and guarded with `if: github.actor != 'github-actions[bot]'`.
3. **No protected-branch auto-fix** (`autofix.yml` is not triggered on `push`).
4. **Deterministic fixes only** in tier 2 (`cargo fmt`, lint/format scripts).
5. **Compliance-sensitive paths blocked/labeled** (`security|audit|crypto|rbac|config/rbac.yaml`):
   - Tier 2: fails if autofix touches these paths.
   - Tier 3: adds `needs-human-review` label and stops.
6. **Terminable CI runs:** every job has explicit timeout and concurrency cancellation.
7. **Release immutability:** release build verifies source, signs bundles, and checks `git diff --exit-code` to enforce zero source mutation.

## Workflow command map

### Tier 1 — `verify.yml`

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`
- Web (package manager auto-detected from lockfile): `lint`, `typecheck`, `test`, `build`
- A11y: `test:a11y` (axe-core critical WCAG 2.1 A/AA scan against built UI)

### Tier 2 — `autofix.yml`

- Runs only on PR branches (non-fork) with write permission to branch head.
- Applies deterministic fixes and commits only when diff exists.
- Bot-loop guard prevents repeated self-triggering.

### Tier 3 — `fix-proposal.yml`

- Triggered manually or when `verify` fails on `main` push.
- Creates a new proposal branch, captures failing-before and passing-after evidence, attempts bounded fixes, and opens a **draft PR** when diff exists.
- Never auto-merges.

### Tier 4 — `release.yml`

- Calls tier-1 `verify.yml` as a gate on the tagged commit.
- Requires protected `release` environment approval.
- Builds signed Tauri artifacts for Linux/macOS/Windows and uploads build artifacts.

## Notes for maintainers

- Root npm scripts now expose `typecheck`, `lint:fix`, `format`, `test:a11y` to support tier-1 and tier-2 workflows.
- Practice UI package (`apps/practice-host-ui`) includes the `axe-core` based accessibility runner used by CI.
