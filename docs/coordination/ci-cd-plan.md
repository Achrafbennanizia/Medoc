# MeDoc CI/CD plan — verify-first, safe auto-fix, gated release

**Status:** implemented in `.github/workflows/{verify,autofix,fix-proposal,release}.yml`  
**Last updated:** 2026-10-25

## Workspace truth used by CI

- Rust workspace: repo-root `Cargo.toml` (`members` in `apps/*` and `crates/*`).
- JS workspace: repo-root `package.json` (`workspaces` in `apps/*` and `packages/*`).
- Legacy `app/` / `app/src-tauri` paths are not used by the active pipeline.

## Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:
- `push` (all branches)
- `pull_request`
- `workflow_call` (used by release gate)

Behavior:
- Rust checks (Ubuntu): `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- JS checks (Ubuntu):
  - Detect package manager from lockfile (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`).
  - Install using detected manager.
  - Lint without auto-fix.
  - Type-check `apps/practice-host-ui` and `apps/lan-web-client`.
  - Run tests and production build.
- Accessibility gate (Ubuntu):
  - Build UI and run `axe-core` against the built preview.
  - Filter findings to WCAG 2.1 A/AA tags.
  - Fail only when impact is `critical`.

Guardrails:
- Verify jobs do not run mutating commands.
- Concurrency cancellation enabled.
- Per-job timeouts enabled.

## Tier 2 — `autofix.yml` (PR branches only, deterministic fixes)

Trigger:
- `pull_request`

Behavior:
- Hard loop guard: skip when actor is `github-actions[bot]`.
- Skip fork PRs (only same-repo branch heads can be pushed).
- Deterministic fixes only:
  - `cargo fmt --all`
  - `eslint --fix` for `apps/practice-host-ui/src`
  - optional root `format` script if present
- Commit and push only if there is a diff.

Guardrails:
- Never runs on `push` to protected branches.
- Never runs on release paths.
- No logic-changing remediation in this tier.

## Tier 3 — `fix-proposal.yml` (substantive fixes via draft PR)

Triggers:
- `workflow_dispatch`
- failed `verify` run on `main` (`workflow_run`)

Behavior:
- Creates a new proposal branch.
- Captures failing-before baseline (`cargo test --workspace`, TS check).
- Applies a substantive fix attempt:
  - optional operator-provided `fix_command`, or
  - conservative dependency remediation fallback.
- Captures passing-after evidence.
- Opens a **draft PR** with rationale and before/after evidence.

Compliance guard:
- If changed paths match security/audit/crypto/RBAC patterns, add `needs-human-review` label and stop the workflow.

## Tier 4 — `release.yml` (tag/dispatch, reproducible and signed)

Triggers:
- tag push: `v*`
- `workflow_dispatch`

Behavior:
- Re-runs full verification via reusable `verify.yml`.
- Builds artifacts only after gate passes.
- Uses protected `release` environment (manual approval).
- Builds signed Tauri bundles with `TAURI_SIGNING_PRIVATE_KEY`.
- Uploads per-OS build artifacts.

Guardrails:
- No source mutation on release path.
- Concurrency cancellation + timeouts enabled.
- Artifact provenance is tied to the tagged commit that passed the gate.
