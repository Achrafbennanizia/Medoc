# MeDoc CI/CD plan (verify, safe autofix, gated release)

## Workspace truth (live paths)

- Rust workspace: repository-root `Cargo.toml` with members under `apps/` and `crates/`.
- JS workspace: repository-root `package.json` workspaces under `apps/` and `packages/`.
- Legacy `app/` path is no longer the active build root.

## Tiered pipeline

### Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:
- `push`
- `pull_request`
- `workflow_call` (used by release gate)

Checks:
- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- JS (package manager detected from lockfile): lint (without `--fix`), typecheck, test, build for workspace package `medoc`.
- Accessibility: built UI scan with `axe-core` (WCAG 2.1 A/AA), failing only on `critical` violations.

Safety controls:
- `concurrency.cancel-in-progress: true`.
- Job timeouts on all jobs.
- No write permissions and no `--fix` in verify jobs.

### Tier 2 — `autofix.yml` (PR branches only, deterministic)

Trigger:
- `pull_request` only.

Fixes:
- `cargo fmt --all`
- `lint:fix`
- `format`

Safety controls:
- Loop guard: skips when actor is `github-actions[bot]`.
- Writes only to PR head branch (never `main`, never release).
- Protected compliance paths (security/audit/crypto/RBAC) are blocked from automated commits.
- `concurrency.cancel-in-progress: true` and timeout.

### Tier 3 — `fix-proposal.yml` (manual or red-main proposal)

Trigger:
- `workflow_dispatch`
- `workflow_run` when `verify` fails on `main`

Behavior:
- Creates a new proposal branch.
- Captures failing-before and passing-after evidence for representative checks.
- Attempts non-deterministic remediation (`cargo update --workspace`, JS audit fix command).
- Opens a **draft** PR with evidence and rationale.

Safety controls:
- Never auto-merges.
- Labels `needs-human-review` and hard-stops if compliance-sensitive paths are touched.

### Tier 4 — `release.yml` (gated, signed, reproducible)

Trigger:
- Tag push `v*`
- `workflow_dispatch`

Behavior:
- Re-runs full verify gate through reusable `verify.yml`.
- Builds signed Tauri bundles on Linux/Windows/macOS only after gate passes.
- Runs in protected `environment: release` for manual approval.
- Uploads artifacts and build provenance attestations.

Safety controls:
- No source mutation.
- Release artifact is built from the tagged commit.

## Legacy CI compatibility

- `.github/workflows/ci.yml` is retained as a thin wrapper (`workflow_dispatch` / `workflow_call`) that delegates to `verify.yml`.
