# MeDoc CI/CD pipeline plan

**Status:** Implemented (2026-10-25)  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Goal

The pipeline verifies and gates merges/releases. It only mutates PR head branches for deterministic, logic-free fixes. Release artifacts are built from reviewed commits without source mutation.

## Workspace baseline

- Rust workspace: repo-root `Cargo.toml` with members under `apps/*` and `crates/*`.
- JS workspace: repo-root `package.json` with workspaces under `apps/*`, `packages/*`, `website`.
- Legacy `app/src-tauri` assumptions are retired for CI/CD gating.

## Tiers

### Tier 1 — `verify.yml` (blocking, zero mutation)

- Triggers: `push`, `pull_request`, `workflow_call`.
- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- Web checks (package manager auto-detected from lockfile):
  - install with pnpm/yarn/npm lockfile strategy
  - `lint` (no `--fix`)
  - `typecheck`
  - `test`
  - `build`
- Accessibility gate:
  - builds UI and runs `scripts/test-a11y.mjs`
  - uses axe-core with WCAG 2.1 A/AA tags
  - fails only on **critical** violations.
- Guardrails:
  - no `--fix` in verify jobs
  - per-job timeout
  - `concurrency.cancel-in-progress: true`.

### Tier 2 — `autofix.yml` (PR branches only)

- Trigger: `pull_request`.
- Loop guard: `github.actor != 'github-actions[bot]'`.
- Skip fork branches for write safety.
- Deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Compliance guardrail:
  - refuses to push if changed paths match `security|audit|crypto|rbac`.
- If diffs exist, commits to PR head branch and pushes once.

### Tier 3 — `fix-proposal.yml` (manual or red main)

- Triggers:
  - `workflow_dispatch`
  - `workflow_run` on failed `verify` runs for `main`
- Runs on a **new branch** (`ci/fix-proposal-*`) only.
- Captures failing-before snapshot, then runs an agent command supplied by secret:
  - `CI_FIX_PROPOSAL_COMMAND`
- Captures passing-after snapshot for non-sensitive changes.
- Opens **draft PR only** (never auto-merges).
- If changed files touch `security|audit|crypto|rbac`, applies `needs-human-review` label and stops automation.

### Tier 4 — `release.yml` (tag/dispatch, gated, zero mutation)

- Triggers:
  - tags `v*`
  - `workflow_dispatch`
- Gate step calls reusable `verify.yml` on the release ref.
- Build step:
  - matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`
  - protected environment: `release` (manual approval point)
  - signed Tauri bundle with:
    - `TAURI_SIGNING_PRIVATE_KEY`
    - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - uploads artifacts and build provenance attestations.
- No source rewrite on release path.

## Notes

- `.github/workflows/ci.yml` is retained as a manual legacy dispatcher and delegates to `verify.yml`.
- `apps/practice-host-ui/package.json` now exposes `typecheck`, `lint:fix`, `format`, and `test:a11y` scripts used by CI tiers.
