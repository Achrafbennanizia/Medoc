# MeDoc CI/CD plan (verify, safe autofix, gated release)

Last updated: 2026-06-25

## Scope

This plan defines a four-tier GitHub Actions pipeline for the live MeDoc workspace:

- Rust workspace at repo root (`Cargo.toml`) with members under `crates/*` and `apps/*`
- JavaScript workspace at repo root (`package.json`) with workspaces under `apps/*` and `packages/*`

The retired `app/src-tauri` and `app/` CI assumptions are not used.

## Non-negotiable rule

Release gates verify and sign artifacts; they do not mutate source code.

## Tier map

| Tier | Workflow | Trigger | Mutates repository | Goal |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, reusable `workflow_call` | No | Blocking verification across Rust, web, and accessibility |
| 2 | `autofix.yml` | `pull_request` only | Yes, PR head branch only | Deterministic formatting and lint autofixes only |
| 3 | `fix-proposal.yml` | Manual dispatch or failed `verify` on `main` | No direct merge; opens draft PR | Non-deterministic fix proposals with human review |
| 4 | `release.yml` | `push` tag `v*` or manual dispatch | No | Re-run verify, require manual approval, build signed artifacts |

## Guardrails

1. Verify jobs never run mutating commands.
2. Auto-fix never runs on protected branches and includes loop guard (`github.actor != 'github-actions[bot]'`).
3. Tier 2 is deterministic only (`cargo fmt`, lint/format autofix).
4. Tier 3 creates draft PRs only; no auto-merge.
5. Changes in security/audit/crypto/RBAC areas are labeled `needs-human-review`.
6. Every job has timeouts and concurrency cancellation to terminate superseded runs.
7. Release artifacts are built from tagged commits in a protected `release` environment and signed with Tauri signing keys.

## Workflow notes

### Tier 1 (`verify.yml`)

- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace --tests`
  - `cargo audit`
- Web checks:
  - Detect package manager from lockfile (`pnpm`, `yarn`, `npm`)
  - Install via lockfile-safe command
  - Lint (no fix), typecheck, test, build
  - Build `lan-web-client` when script exists
- Accessibility:
  - Build UI
  - Run `@axe-core/cli` with `wcag21aa`
  - Fail only on `critical` impact violations

### Tier 2 (`autofix.yml`)

- PR-only execution
- Skips bot-authored commits (loop guard)
- Applies deterministic fixes and commits back to PR head branch when needed

### Tier 3 (`fix-proposal.yml`)

- Manual mode accepts:
  - failing-before command
  - fix command
  - passing-after command
- Automatic mode (failed `verify` on `main`) uses `CI_FIX_PROPOSAL_COMMAND` repository variable
- Captures before/fix/after evidence in draft PR body
- If no patch is produced, workflow fails without opening PR

### Tier 4 (`release.yml`)

- Calls tier-1 verify as reusable gate
- Builds on Linux, macOS, and Windows after gate passes
- Uses protected `release` environment for manual approval
- Runs signed Tauri build with:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Uploads bundles and emits provenance attestations
