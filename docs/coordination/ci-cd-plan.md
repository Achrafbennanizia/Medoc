# MeDoc CI/CD Plan (verify-first, safe autofix, gated release)

## Scope

This plan applies to the live repository layout:

- Rust workspace: `Cargo.toml` at repo root with members in `apps/*` and `crates/*`
- JS workspace: root `package.json` with workspaces in `apps/*` and `packages/*`
- Workflows: `.github/workflows/*.yml`

The retired `app/src-tauri` + `app/` assumptions are not used.

## Non-negotiable rule

Release gates verify artifacts from reviewed commits. They do not rewrite source.

- Verify jobs are immutable and blocking.
- Auto-fix is deterministic, PR-branch-only, and loop-guarded.
- Substantive fixes are proposed as draft PRs (never auto-merged).
- Release reruns verification and signs artifacts under manual approval.

## Tier map

| Tier | Workflow | Trigger | Mutates repository | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking Rust/web/a11y validation |
| 2 | `autofix.yml` | `pull_request` | PR head only | Deterministic `cargo fmt` + lint/format autofix |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` push | Opens draft PR only | Agent-style substantive fix proposal with before/after evidence |
| 4 | `release.yml` | tag `v*`, `workflow_dispatch` | No source mutation | Verify gate + signed cross-platform build in protected `release` environment |

## Tier details

### Tier 1 — `verify.yml` (blocking, zero mutation)

- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace --tests`
  - `cargo audit`
- Web checks:
  - Detect package manager via lockfile (`pnpm-lock.yaml` / `yarn.lock` / fallback `package-lock.json`)
  - Run `lint`, `typecheck`, `test`, `build` without any `--fix` flags
- Accessibility:
  - Build web UI
  - Run axe-core (`wcag2a,wcag2aa`) against built UI
  - Fail only on **critical** violations
- Safety rails:
  - `concurrency.cancel-in-progress: true`
  - Per-job timeouts

### Tier 2 — `autofix.yml` (PR branches only, deterministic only)

- Triggered only by `pull_request`
- Hard loop guard: `if: github.actor != 'github-actions[bot]'`
- Additional guard: skip fork PRs (cannot push head safely)
- Applies deterministic, logic-free commands:
  - `cargo fmt --all`
  - `lint:fix` (if present)
  - `format` (if present)
- Commits only when files changed and pushes back to PR head branch

### Tier 3 — `fix-proposal.yml` (draft PR proposals only)

- Supports:
  - Manual dispatch with explicit commands:
    - failing-before command
    - fix command
    - passing-after command
  - Auto-trigger on failed `verify` runs for `main` pushes
- Always creates a **new branch** (`ci/fix-proposal/*`) and opens a **draft PR**
- Attaches evidence artifacts:
  - `failing-before.log`
  - `passing-after.log`
  - changed file list
- Sensitive area guard:
  - If changed files match `security|audit|crypto|rbac`, label `needs-human-review` and stop the automation path
- Optional unattended auto-trigger settings via repository variables:
  - `CI_FIX_PROPOSAL_FAILING_COMMAND`
  - `CI_FIX_PROPOSAL_FIX_COMMAND`
  - `CI_FIX_PROPOSAL_PASSING_COMMAND`

### Tier 4 — `release.yml` (gated, reproducible, signed)

- Triggered by tags `v*` or manual dispatch
- `gate` job calls reusable `verify.yml` (`workflow_call`) to re-verify release commit
- `build` job:
  - runs under protected `environment: release` (manual approval gate)
  - matrix builds on Linux/macOS/Windows
  - reruns `cargo test --workspace --tests` (verify-only)
  - signs bundles using `TAURI_SIGNING_PRIVATE_KEY`
  - uploads artifacts from `apps/practice-host/target/release/bundle/**/*`

## Guardrails checklist

- [x] Verify workflows do not mutate source.
- [x] Auto-fix restricted to PR head branches, deterministic commands only.
- [x] Loop guard prevents bot self-trigger cascades.
- [x] Substantive fixes go through draft PR proposal flow.
- [x] Sensitive-code touches are labeled `needs-human-review` and halted.
- [x] Concurrency cancellation + timeouts on all tier workflows.
- [x] Release build is gated, signed, and source-immutable.
