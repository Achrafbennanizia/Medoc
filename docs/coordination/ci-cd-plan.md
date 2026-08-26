# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

## Scope and baseline

- Rust workspace: `Cargo.toml` members under `apps/*` and `crates/*`.
- JS workspace: root `package.json` workspaces under `apps/*` and `packages/*`.
- Legacy `ci.yml` is replaced by tiered workflows in `.github/workflows/`.

The release gate verifies and signs only. It does not mutate source on protected or release paths.

## Tiers

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push` (`main`), `pull_request`, reusable `workflow_call` | No | Blocking verification (Rust + JS + a11y) |
| 2 | `autofix.yml` | `pull_request` | PR branch only | Deterministic formatting/lint autofixes only |
| 3 | `fix-proposal.yml` | `workflow_dispatch` and failed `verify` on `main` | New proposal branch only | Agent-style draft PR with evidence |
| 4 | `release.yml` | tag `v*` or `workflow_dispatch` | No | Re-verify tagged commit + signed cross-platform build under manual approval |

## Tier 1 (`verify.yml`)

### Rust checks

- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`

### JS checks

Package manager is detected from lockfile (`pnpm-lock.yaml` / `yarn.lock` / fallback `package-lock.json`).

- Lint (no `--fix`): `medoc`
- Typecheck: `medoc` and `medoc-lan-web-client`
- Test: `medoc`
- Build: `medoc` and `medoc-lan-web-client`

### Accessibility checks

- Build `medoc` web UI.
- Run Playwright + axe-core audit (`wcag2a`, `wcag2aa`) via `apps/practice-host-ui/scripts/run-a11y.mjs`.
- Fail only when critical violations are found.

## Tier 2 (`autofix.yml`)

Guardrails:

- Triggered only by `pull_request`.
- Loop guard: skips bot-authored loop (`if: github.actor != 'github-actions[bot]'`).
- Refuses fork PR mutation (`head.repo.full_name == github.repository`).

Deterministic-only actions:

- `cargo fmt --all`
- `medoc` `lint:fix`
- `medoc` `format`

If files changed, commits to PR head branch and pushes once; verify then re-runs on the updated head commit.

## Tier 3 (`fix-proposal.yml`)

Purpose: non-deterministic fix proposals (tests, advisories, type errors) on a new branch with a draft PR.

Flow:

1. Trigger manually (`workflow_dispatch`) or automatically when `verify` fails on `main`.
2. Resolve fix command from dispatch input `fix_command` or secret `CI_FIX_AGENT_COMMAND`.
3. Optionally capture failing-before and passing-after command evidence.
4. Run fix command on a new branch `ci/fix-proposal/...`.
5. Open a **draft PR** with rationale and command exit-code evidence.
6. If changed files touch security/audit/crypto/RBAC paths, add `needs-human-review` label and fail the workflow to enforce manual review.

No auto-merge is performed.

## Tier 4 (`release.yml`)

- Trigger: `v*` tag or `workflow_dispatch`.
- Gate: calls `verify.yml` on the exact tagged commit.
- Build: matrix for Linux/Windows/macOS.
- Approval: job runs in protected `release` environment (manual approval gate).
- Action: verify (`cargo test --workspace`) + signed `tauri build`.
- Output: upload bundle artifacts only; no source mutation.

## Global guardrails

- Verify workflows never run `--fix`.
- Auto-fix never runs on `push main` or release paths.
- Jobs use timeouts and concurrency cancellation to terminate superseded runs.
- Sensitive-area proposals are explicitly blocked for mandatory human review.
