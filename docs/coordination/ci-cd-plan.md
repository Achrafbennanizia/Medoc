# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

Last updated: 2026-08-25

## Goal

Make CI/CD a **verify-first gate**:

- Verify jobs never mutate repository state.
- Deterministic autofix is allowed only on PR head branches.
- Non-deterministic fixes are proposed in draft PRs for human review.
- Release builds from the reviewed/tagged commit under manual approval.

## Workspace detection (verified)

- Rust workspace root: `Cargo.toml` with members under `apps/*` and `crates/*`.
- JS workspace root: `package.json` workspaces under `apps/*` and `packages/*`.
- Lockfile in this repo: `package-lock.json` (pipeline still auto-detects pnpm/yarn/npm).

## Workflow map

| Tier | Workflow | Trigger | Mutates repo? | Notes |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/ci.yml` + `.github/workflows/verify.yml` | `push` + `pull_request` (`ci.yml`), reusable via `workflow_call` (`verify.yml`) | No | CI wrapper preserves branch protection compatibility; verify logic is reusable for release gate. |
| 2 | `.github/workflows/autofix.yml` | `pull_request` only | Yes (PR head only) | Deterministic-only fixes; loop guard blocks bot-author loops. |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch` or failed `CI` on `main` | Opens draft PR only | Requires configured fix-agent command; labels sensitive-path proposals `needs-human-review`. |
| 4 | `.github/workflows/release.yml` | `push` tags `v*` or `workflow_dispatch` | No | Re-runs verify gate, then signed build in protected `release` environment. |

## Tier 1 details (`verify.yml`)

### Rust gate

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`

### Web gate

- Detect package manager from lockfile (`pnpm-lock.yaml` / `yarn.lock` / fallback `package-lock.json`).
- Install with frozen/CI lock mode.
- Run `lint`, `typecheck` (or fallback `tsc --noEmit`), `test`, `build` without `--fix`.

### Accessibility gate

- Run `test:a11y` script when present.
- Fallback: build app, serve `apps/practice-host-ui` via `vite preview`, run `@axe-core/cli` with `wcag2aa` tags.
- Fail if any **critical** violation is found.

### Guardrails

- Workflow-level concurrency cancellation (`cancel-in-progress: true`).
- Per-job timeouts.
- No verify-step writebacks/commits.

## Tier 2 details (`autofix.yml`)

- Trigger: `pull_request` only.
- Skip on bot actor and bot-authored head commit (loop guard).
- Deterministic-only commands:
  - `cargo fmt --all`
  - `lint:fix` (if script exists)
  - `format` (if script exists)
- Commit and push back only when git diff exists.
- No execution on `push` to `main` and no release-path mutation.

## Tier 3 details (`fix-proposal.yml`)

- Trigger:
  - Manual dispatch, or
  - Failed `CI` run on `main`.
- Runs a configured agent command from secret `FIX_PROPOSAL_AGENT_COMMAND`.
- Collects post-fix verification evidence (`cargo test --workspace`, web test command).
- Opens **draft PR** only when a diff exists.
- If touched paths match security/audit/crypto/RBAC naming, adds label `needs-human-review`.
- No auto-merge behavior.

## Tier 4 details (`release.yml`)

- Trigger: `v*` tags or manual dispatch.
- Job `gate` calls reusable verify workflow on release ref.
- Job `build`:
  - Requires protected environment `release` (manual approval gate).
  - Builds signed Tauri bundles on Linux/macOS/Windows.
  - Uploads artifacts from `apps/practice-host/target/release/bundle/**/*`.
- No source mutation in release path.

## Operational notes

- `ci.yml` is intentionally kept as a thin wrapper so existing CI integrations and required checks referencing “CI” keep working while verify logic is centralized in `verify.yml`.
- Tier 3 requires repository maintainers to configure `FIX_PROPOSAL_AGENT_COMMAND`; without it, fix-proposal runs fail fast with a clear error.
