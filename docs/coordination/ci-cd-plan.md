# MeDoc CI/CD pipeline plan (verify-first, safe auto-fix, gated release)

**Last updated:** 2026-09-26  
**Scope:** `.github/workflows/{verify,autofix,fix-proposal,release}.yml`

## Workspace truth (for pipeline targeting)

- Rust workspace is rooted at `Cargo.toml` with members under `apps/` and `crates/`.
- JavaScript workspace is rooted at `package.json` with workspaces under `apps/`, `packages/`, and `website/`.
- CI must treat `app/` and `app/src-tauri` as retired paths for workflow execution.

## Tier model

| Tier | Workflow | Trigger | Repo mutation |
| --- | --- | --- | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No |
| 2 | `autofix.yml` | `pull_request` | Yes (PR head branch only) |
| 3 | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | Yes (new branch only, draft PR) |
| 4 | `release.yml` | tag `v*` or manual dispatch | No source mutation |

## Guardrails

1. Verify jobs never run `--fix` and never commit.
2. Autofix runs only for PRs from this repository and skips bot-authored commits.
3. Autofix is limited to deterministic format/lint operations (`cargo fmt`, eslint/prettier when available).
4. Fix proposals are always draft PRs and never auto-merge.
5. If a fix proposal touches security/audit/crypto/RBAC paths, it is labeled `needs-human-review` and the workflow stops.
6. Concurrency cancellation + job timeouts are configured for all tiers.
7. Release builds run behind a protected `release` environment and use signing secrets for updater-compatible artifacts.

## Tier implementation notes

### Tier 1 — verify

- Rust checks: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- JavaScript package manager is lockfile-detected (`pnpm`, `yarn`, `npm`) and used consistently for install/lint/test/build.
- Typecheck runs via root script when present; otherwise runs direct `tsc --noEmit` for the active UI workspaces.
- Accessibility gate uses `scripts/test-a11y.mjs` (axe-core) and fails only on critical WCAG 2.1 A/AA violations.

### Tier 2 — autofix

- PR-only deterministic cleanup:
  - `cargo fmt --all`
  - `lint:fix` (or eslint fallback)
  - `format` (or prettier fallback when present)
- If files changed, bot commits and pushes once to the PR head branch.
- Loop guard: workflow ignores runs authored by `github-actions[bot]`.

### Tier 3 — fix proposal

- Starts from the failing `main` commit (or manual base ref).
- Captures before/after evidence for:
  - `cargo test --workspace`
  - typecheck
  - `cargo audit`
- Applies best-effort repair attempts, commits on a fresh branch, and opens a **draft** PR with evidence.
- Sensitive file touches (`security|audit|crypto|rbac`) trigger `needs-human-review` labeling and an immediate stop.

### Tier 4 — release

- Reuses Tier-1 verify as a gate on the exact tagged/manual commit.
- Cross-platform signed build matrix (`ubuntu`, `windows`, `macos`) under protected `release` environment.
- Build path verifies/tests and signs artifacts; no source rewrite steps are allowed.

