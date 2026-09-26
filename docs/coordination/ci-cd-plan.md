# MeDoc CI/CD pipeline plan

**Last updated:** 2026-09-26  
**Scope:** GitHub Actions workflows in `.github/workflows/`  
**Goal:** verify and gate merges/releases while allowing only safe, deterministic auto-fixes on PR branches.

## Workspace detection (authoritative paths)

- Rust workspace root: `Cargo.toml` at repository root with active members under:
  - `apps/*` (notably `apps/practice-host`)
  - `crates/*`
- JS workspace root: `package.json` at repository root with workspaces under:
  - `apps/*`
  - `packages/*`

Legacy `app/src-tauri` and `app/` CI assumptions are retired and must not be reintroduced.

## Tier model

| Tier | Workflow | Trigger | Mutates source? | Purpose |
|---|---|---|---|---|
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking quality/security/accessibility gate |
| 2 | `autofix.yml` | `pull_request` only | Yes (PR head branch only) | Deterministic formatting/lint autofix |
| 3 | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | Opens draft PR only | Substantive fix proposal with evidence |
| 4 | `release.yml` | `push` tags `v*` or `workflow_dispatch` | No | Verify gate + signed release artifacts under manual approval |

`ci.yml` is a compatibility wrapper and delegates to `verify.yml`.

## Guardrails

1. Verify jobs never run `--fix` and never commit.
2. Auto-fix runs only on PR events, with loop guard:
   - `if: github.actor != 'github-actions[bot]'`
3. Tier 2 only performs deterministic edits (`cargo fmt`, `lint:fix`, `format`).
4. Tier 3 always opens **draft** PRs; it never auto-merges.
5. If Tier 3 touches `security`, `audit`, `crypto`, or `rbac` paths, it adds/attempts `needs-human-review` and hard-stops for manual review.
6. Workflows use `concurrency.cancel-in-progress` and job `timeout-minutes` to terminate superseded runs.
7. Release artifacts are built from verified tagged commit state and signed via Tauri signing secrets; no source mutation is permitted in release jobs.

## Tier details

### Tier 1 — `verify.yml`

- Rust:
  - `cargo fmt --all -- --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS:
  - Detect package manager from lockfile (`pnpm`, `yarn`, fallback `npm`)
  - Install frozen dependencies
  - `lint` (no `--fix`)
  - `typecheck` (or `check` fallback)
  - `test`
  - `build`
- Accessibility:
  - Build UI
  - Run `axe-core` (or `test:a11y` if project script exists)
  - Fail on any **critical** WCAG 2.1 A/AA violations

### Tier 2 — `autofix.yml`

- Runs only for same-repository PRs.
- Applies deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix` script if present
  - `format` script if present
- Commits and pushes only when `git status --porcelain` is non-empty.

### Tier 3 — `fix-proposal.yml`

- Entry points:
  - Manual dispatch
  - Automatic trigger when `verify` fails on `main`
- Captures:
  - verify-before exit code
  - fix-attempt exit code
  - verify-after exit code
  - changed-file list + log excerpts
- Creates new branch `ci/fix-proposal-<run_id>` and opens **draft PR**.
- Restricted-path guard:
  - If changed files match `(security|audit|crypto|rbac)`, label as `needs-human-review` (best effort) and stop.

### Tier 4 — `release.yml`

- Triggers on `v*` tags or manual dispatch.
- Re-runs full verify gate through reusable workflow call.
- Builds on `ubuntu/windows/macos` matrix under protected `release` environment.
- Produces signed bundles (`TAURI_SIGNING_PRIVATE_KEY*`) and uploads artifacts.
- Generates build provenance attestation.

## Repository settings expected

- Protected environment `release` requiring manual approval.
- Required secrets for signing:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Optional repo variables for Tier 3:
  - `CI_FIX_PROPOSAL_COMMAND`
  - `CI_FIX_PROPOSAL_BASELINE_COMMAND`

## Out of scope for automation

- Auto-merging any CI-generated PR.
- Non-deterministic Tier 2 edits.
- Silent mutation of protected/release branches.
