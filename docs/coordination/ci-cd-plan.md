# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Verified workspace map

- Rust workspace root: `Cargo.toml` with members under `apps/` and `crates/`.
- JS workspace root: `package.json` with workspaces under `apps/` and `packages/`.
- Legacy monolithic workflow replaced: `.github/workflows/ci.yml` retired in favor of tiered workflows.

## Tiered workflows

### Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:

- `push` to `main`
- all `pull_request`s
- `workflow_call` (for release gate reuse)

Jobs:

- `rust`: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace`, `cargo audit`
- `web`: lockfile-based package-manager detection (`pnpm`/`yarn`/`npm`) + lint (no `--fix`) + typecheck + test + build
- `a11y`: build + axe-core check (fails only on **critical WCAG 2.1 AA** violations)

Controls:

- workflow concurrency cancellation
- per-job timeouts
- read-only permissions

### Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only

Scope:

- deterministic fixes only: `cargo fmt`, `lint:fix`, `format`
- writes only to PR head branch

Guards:

- loop guard: `if: github.actor != 'github-actions[bot]'`
- skips forked PR heads (no writeback)
- concurrency cancellation
- timeout

### Tier 3 — `fix-proposal.yml` (substantive fix proposals)

Trigger:

- `workflow_dispatch` (manual proposal)
- `workflow_run` when `verify` fails on `main`

Behavior:

- creates a new proposal branch (`ci/fix-proposal-<run-id>`)
- executes a configured agent command (manual input or `CI_FIX_PROPOSAL_AGENT_COMMAND`)
- runs post-fix validation (manual input or `CI_FIX_PROPOSAL_VALIDATE_COMMAND`)
- opens a **draft** PR with before/after evidence (`.github/fix-proposal-evidence.md`)

Sensitive-path guard:

- if changes touch `security`/`audit`/`crypto`/`rbac` paths, adds `needs-human-review` label and hard-stops the automation job.

### Tier 4 — `release.yml` (gated CD, no source mutation)

Trigger:

- tag push `v*`
- `workflow_dispatch`

Flow:

1. `gate` job reuses full `verify.yml` on the tagged commit.
2. `build` job runs on `ubuntu`, `windows`, `macos` under protected `release` environment.
3. Build verifies (`cargo test --workspace --tests`) and signs Tauri bundles (`npx tauri build`) without editing source.
4. Artifacts uploaded per OS.

## Guardrails (always on)

- Verify workflows never run auto-fix flags.
- Auto-fix is isolated to PR branches and bot-loop guarded.
- Substantive fixes are draft-PR proposals, never auto-merge.
- Sensitive areas (`security/audit/crypto/rbac`) are blocked for unattended merge paths.
- All workflows enforce timeout + cancel-in-progress semantics.
- Release artifacts are built from verified tagged commits in a protected environment.

## Required repository settings

- Protect `main` and require `verify` status checks.
- Configure protected `release` environment with manual approvals.
- Add release signing secrets:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Optional for Tier 3 automation:
  - repository variable `CI_FIX_PROPOSAL_AGENT_COMMAND`
  - repository variable `CI_FIX_PROPOSAL_VALIDATE_COMMAND`
