# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Status

- Implemented workflows:
  - `.github/workflows/verify.yml` (tier 1)
  - `.github/workflows/autofix.yml` (tier 2)
  - `.github/workflows/fix-proposal.yml` (tier 3)
  - `.github/workflows/release.yml` (tier 4)
- Legacy `.github/workflows/ci.yml` is retained as a manual dispatcher notice only.

## Workspace detection (live layout)

- Rust workspace root: `Cargo.toml` with members under:
  - `apps/practice-host`
  - `crates/app/*`
  - `crates/server/*`
  - `crates/shared/*`
  - `crates/test/*`
  - `installer/*`
- JavaScript workspace root: `package.json` with workspaces under:
  - `apps/practice-host-ui`
  - `apps/practice-host`
  - `apps/lan-web-client`
  - `packages/*`
  - `website`

This is the canonical path basis for CI/CD. Retired `app/` and `app/src-tauri` assumptions are not used in the new tiered workflows.

## Tier model

## Tier 1 — verify (`verify.yml`)

**Trigger:** push to `main`, pull requests, and reusable `workflow_call`  
**Mutation:** none (blocking gate)

- Rust verify:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- Web verify:
  - lockfile-based package manager detection (`pnpm`/`yarn`/`npm`)
  - install with frozen lock semantics
  - lint (no `--fix`)
  - typecheck (`tsc --noEmit` for active app targets)
  - test
  - build
- Accessibility verify:
  - build web UI
  - run `@axe-core/cli` against built output
  - fail on **critical** WCAG 2.1 AA violations

Guardrails:

- `concurrency.cancel-in-progress: true`
- per-job timeouts
- no mutation commands

## Tier 2 — autofix (`autofix.yml`)

**Trigger:** `pull_request` only  
**Mutation:** yes, PR head branch only, deterministic fixes only

- Loop guard:
  - job runs only when actor is not `github-actions[bot]`
  - restricted to same-repository PR heads (no fork push attempts)
- Commands:
  - `cargo fmt --all`
  - JS `lint:fix` and `format` when present
  - deterministic fallback eslint fix pass for app UI
- Commit and push only when changes exist.

Safety guard:

- If diff touches compliance-sensitive paths (`security`, `audit`, `crypto`, `rbac`, `auth`, `license` patterns), the job fails and does not push.

## Tier 3 — fix proposal (`fix-proposal.yml`)

**Trigger:** manual dispatch or failed `verify` run on `main` (`workflow_run`)  
**Mutation:** new proposal branch only; opens draft PR; never auto-merge

- Captures:
  - failing-before command output
  - fix-attempt output
  - passing-after command output
- Attempts real fixes via:
  - predefined mode commands (`auto`, `test`, `advisory`, `typecheck`, `custom`)
  - optional user-supplied `fix_command` / `verify_command`
- Opens a **draft PR** on a new `ci/fix-proposal-*` branch with rationale and evidence tails.

Compliance guard:

- If proposal diff touches compliance-sensitive paths, label includes `needs-human-review` and workflow stops after PR creation.

## Tier 4 — release (`release.yml`)

**Trigger:** version tag `v*` or manual dispatch  
**Mutation:** no tracked-source mutation; verify + signed build only

- `gate` job reuses full tier-1 verify via `workflow_call`.
- `build` job:
  - matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`
  - protected `environment: release` for manual approval gate
  - re-runs `cargo test --workspace`
  - creates a **temporary runner-local** Tauri release config for updater signing (no tracked file edits)
  - runs signed Tauri build using `TAURI_SIGNING_PRIVATE_KEY`
  - uploads artifacts

## Global guardrails

1. Verify jobs do not mutate source.
2. Autofix is PR-only and loop-guarded.
3. Deterministic-only changes in tier 2.
4. Compliance-sensitive paths are blocked or escalated with `needs-human-review`.
5. No infinite retries; concurrency cancellation and timeouts are set.
6. Release artifacts are built from the reviewed/tagged commit through a protected release environment.
