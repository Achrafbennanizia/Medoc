# MeDoc CI/CD plan — verify, safe autofix, gated release

## Scope and workspace truth

- Rust workspace is rooted at `Cargo.toml` with members under `apps/*` and `crates/*`.
- JavaScript workspace is rooted at `package.json` with workspaces under `apps/*` and `packages/*`.
- Legacy `app/src-tauri` / `app/` workflow assumptions are retired; CI now targets the live repo-root workspace.

## Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:

- `push`
- `pull_request`
- `workflow_call` (for release gate reuse)

Checks:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lockfile-driven package-manager detection (pnpm/yarn/npm), then lint (no `--fix`), typecheck, test, build for live workspace packages
- Accessibility: axe-core scan of built UI; fail only on **critical** WCAG 2.1 A/AA violations

Safety:

- Read-only permissions
- Concurrency cancellation (`verify-${ref}`)
- Per-job timeouts

## Tier 2 — `autofix.yml` (PR-only deterministic fixes)

Trigger:

- `pull_request`

Fix scope (deterministic only):

- `cargo fmt --all`
- `lint:fix` and `format` in `apps/practice-host-ui`

Safety:

- Never runs on `push` to protected branches
- Bot loop guard: skip when actor is `github-actions[bot]`
- Writes only to the PR head branch in the same repository
- Concurrency cancellation + timeout

## Tier 3 — `fix-proposal.yml` (manual or failed main verify)

Trigger:

- `workflow_dispatch`
- `workflow_run` from `verify` when `main` push concludes `failure`

Behavior:

- Creates a new proposal branch
- Captures failing-before evidence
- Attempts deterministic baseline fixes
- Captures passing-after evidence
- Opens a **draft PR** with rationale + evidence table

Safety:

- Never auto-merges
- If diff touches security/audit/crypto/RBAC paths, adds `needs-human-review` label and stops
- Concurrency cancellation + timeout

## Tier 4 — `release.yml` (gated, reproducible, signed)

Trigger:

- `push` tags `v*`
- `workflow_dispatch`

Behavior:

- Re-runs full verify via reusable workflow call (`verify.yml`)
- Builds signed artifacts across Linux/macOS/Windows
- Requires protected `release` environment approval

Safety:

- No source mutation in release jobs
- Concurrency cancellation + timeout
- Signed bundles built from the exact tagged commit

## Guardrail summary

1. Verify jobs never mutate source.
2. Autofix mutates PR branches only, with loop guard.
3. Deterministic fixes stay in tier 2; substantive fixes route to draft PR proposals in tier 3.
4. Security/audit/crypto/RBAC diffs are explicitly flagged for human review.
5. Release path is gated, reproducible, and signed.
