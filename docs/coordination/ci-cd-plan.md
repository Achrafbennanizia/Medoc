# MeDoc CI/CD plan (gated verify, safe autofix, draft fix proposals)

## Scope

This plan defines a four-tier CI/CD model that prioritizes verification and release reproducibility:

1. **Tier 1 — verify** (`.github/workflows/verify.yml`)
2. **Tier 2 — autofix** (`.github/workflows/autofix.yml`)
3. **Tier 3 — fix proposal** (`.github/workflows/fix-proposal.yml`)
4. **Tier 4 — release** (`.github/workflows/release.yml`)

## Workspace detection (live paths)

- **Rust workspace:** repo-root `Cargo.toml` (`members` include `apps/practice-host`, `crates/*`)
- **JavaScript workspace:** repo-root `package.json` (`workspaces` include `apps/*`, `packages/*`)
- **Lockfile:** `package-lock.json` (npm currently active)

The workflows detect package manager from lockfiles (pnpm/yarn/npm) and avoid hardcoded legacy `app/src-tauri` assumptions.

## Tier behavior

### Tier 1 — verify (blocking, zero mutation)

Trigger: `push` to `main`, all `pull_request`, reusable via `workflow_call`.

Checks:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lint, typecheck, test, build
- Accessibility: `test:a11y` (axe-core against built UI; fails on critical WCAG 2.1 A/AA)

Controls:

- `concurrency.cancel-in-progress: true`
- per-job timeout limits
- `git diff --exit-code` guard to assert verify jobs do not mutate source

### Tier 2 — autofix (PR-only deterministic fixes)

Trigger: `pull_request` only.

Safe deterministic operations:

- `cargo fmt --all`
- JS `lint:fix`
- JS `format` (script-defined deterministic formatting)

Controls:

- loop guard: skip when actor is `github-actions[bot]`
- skips fork PR branches
- commits only when tree changed
- pushes only to PR head branch

### Tier 3 — fix proposal (substantive changes as draft PRs)

Trigger:

- manual `workflow_dispatch`
- automatic when `verify` fails on `main` (`workflow_run`)

Behavior:

- creates **new branch** (`ci/fix-proposal-<run_id>`)
- captures **failing-before** and **passing-after** command evidence
- opens **draft PR only** (no auto-merge path)
- adds `needs-human-review` and stops when changed files touch `security|audit|crypto|rbac` path patterns

Notes:

- automated red-main path requires an explicit strategy (`scripts/ci/fix-proposal.sh`) or manual dispatch input.

### Tier 4 — release (verify + signed build, no mutation)

Trigger: version tags (`v*`) and manual dispatch.

Behavior:

- calls Tier 1 verify as release gate on the tagged commit
- requires protected `release` environment approval
- builds signed cross-platform bundles
- uploads artifacts per OS
- `git diff --exit-code` guard enforces zero source mutation

## Guardrails

- Verify jobs never run `--fix` mutators.
- Autofix never runs on protected branch pushes or release paths.
- No retry loops in workflows; superseded runs are canceled by concurrency.
- Every job has a timeout.
- Release artifacts are built from the gated tagged commit and signing secrets.
