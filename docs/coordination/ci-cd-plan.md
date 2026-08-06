# MeDoc CI/CD plan (verify-first, safe auto-fix, gated release)

## Verified workspace targets

- **Rust workspace:** root `Cargo.toml` members under `apps/*` and `crates/*`.
- **JS workspace:** root `package.json` workspaces under `apps/*` and `packages/*`.
- **Tauri Rust app path:** `apps/practice-host` (with `apps/practice-host-ui/src-tauri` symlink).
- **Retired path removed from active CI:** legacy `.github/workflows/ci.yml` replaced with tiered workflows.

## Tiered pipeline

### Tier 1 — `verify.yml` (blocking, zero mutation)

**Triggers:** every `push`, `pull_request`, and `workflow_call` (for release gate reuse).

Checks:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- Web: package-manager detection (`pnpm` / `yarn` / `npm`), then lint (no `--fix`), type-check, tests, builds (`apps/practice-host-ui` and `apps/lan-web-client`).
- Accessibility: builds UI and runs `axe-core` against the built app, failing on **critical** WCAG 2.1 A/AA violations.

Safety:

- `concurrency.cancel-in-progress: true`
- per-job timeouts
- no repository mutation in verify jobs

### Tier 2 — `autofix.yml` (PR branches only, deterministic fixes)

**Trigger:** `pull_request`

Safety gates:

- Runs only when `github.actor != 'github-actions[bot]'`.
- Runs only for same-repository PR branches.
- Concurrency cancellation per PR head branch.

Mutations allowed:

- `cargo fmt --all`
- JS deterministic lint/format fixes (`lint:fix` when present, otherwise `lint -- --fix`; optional `format` scripts if present)

Behavior:

- Commits and pushes only when files changed.
- No non-deterministic logic changes.

### Tier 3 — `fix-proposal.yml` (draft PR proposal, never auto-merge)

**Triggers:** manual `workflow_dispatch` or failed `verify` run on `main` (`workflow_run`).

Flow:

1. Captures baseline failures (`cargo test`, `cargo audit`, type-check).
2. Creates a new branch `ci/fix-proposal-<run_id>`.
3. Attempts automated proposal changes.
4. Re-runs checks and records before/after evidence.
5. Opens a **draft PR** via automation action.

Guardrail:

- If changed paths include `security`, `audit`, `crypto`, or `rbac`, PR is labeled **`needs-human-review`**.

### Tier 4 — `release.yml` (gated, signed, zero source mutation)

**Triggers:** tag push `v*` or manual `workflow_dispatch`.

Flow:

1. `gate` job re-runs full `verify.yml` on tagged commit.
2. `build` job matrix builds on Linux / Windows / macOS.
3. Uses protected `release` environment for manual approval.
4. Re-verifies (`cargo test --workspace`) and builds signed bundles.
5. Uploads release artifacts per OS.

Guarantees:

- Release path verifies and signs the tagged commit.
- No auto-fix workflow runs on release.

## Global guardrails

1. Verify tiers never mutate source.
2. Auto-fix tier never runs on `push main` or release.
3. Auto-fix loop guard prevents bot self-loop.
4. Deterministic-only mutation in auto-fix.
5. Security/audit/crypto/RBAC changes are human-gated in fix-proposal.
6. Concurrency + timeouts enforce terminable runs.
7. Release builds are approval-gated and signed.
