# MeDoc CI/CD plan — verify-first, safe autofix, gated release

## Scope

This plan defines a four-tier GitHub Actions pipeline for the live MeDoc workspace:

- Rust workspace at repository root (`Cargo.toml`) with members under `apps/` and `crates/`.
- JS app entrypoint at `apps/practice-host-ui` with root lockfile detection (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`).

## Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:

- `push` (all branches)
- `pull_request`
- `workflow_call` (used by release gate)

Jobs:

1. **rust**
   - `cargo fmt --all -- --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
   - `cargo audit`
2. **web**
   - Detect package manager from lockfile.
   - Install with frozen lockfile semantics (`pnpm install --frozen-lockfile` / `yarn install --frozen-lockfile` / `npm ci`).
   - `lint` (no `--fix`)
   - `typecheck`
   - `test`
   - `build`
3. **a11y**
   - Build UI
   - Run `test:a11y` (axe-core scan on built preview; fails on critical WCAG 2.1 AA violations)

Guardrails:

- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`
- no write permissions and no repo mutation commands

## Tier 2 — `autofix.yml` (PR branches only, deterministic only)

Trigger:

- `pull_request`

Rules:

- Never runs on `push` to protected branches.
- Loop guard:
  - Job-level actor guard: skip when actor is `github-actions[bot]`.
  - Commit-author guard: skip when latest commit is bot-authored.
- Deterministic-only commands:
  - `cargo fmt --all`
  - `lint:fix` (if script exists)
  - `format` (if script exists)
- Commits only when working tree changed.

## Tier 3 — `fix-proposal.yml` (draft PR proposals, never auto-merge)

Trigger:

- `workflow_dispatch` (manual, with `failure_kind` and optional `fix_command`)
- `workflow_run` on failed `verify` runs for `main`

Behavior:

- Creates/uses a new proposal branch name per run.
- Captures failing-before and post-fix probe evidence in workflow artifacts.
- Opens **draft PR** via `peter-evans/create-pull-request`.
- Never auto-merges.

Sensitive-path guard:

- If touched files match `security`, `audit`, `crypto`, or `rbac`, label with `needs-human-review` and stop for manual review.

## Tier 4 — `release.yml` (gated, reproducible, signed)

Trigger:

- `push` tags `v*`
- `workflow_dispatch`

Flow:

1. **gate** job calls `verify.yml` via `workflow_call`.
2. **build** matrix (`ubuntu-latest`, `windows-latest`, `macos-latest`) under protected `environment: release`.
3. Re-runs verification command (`cargo test --workspace`) and builds signed Tauri bundles.
4. Produces `SHA256SUMS.txt` and uploads artifacts.
5. Attests build provenance (`actions/attest-build-provenance`).

Release mutation policy:

- Build pipeline does not run formatter/fix commands.
- No source edits are committed in release path.

## Compatibility entrypoint

- `.github/workflows/ci.yml` is retained as a compatibility wrapper that delegates to `verify.yml` via `workflow_call` / manual dispatch.

