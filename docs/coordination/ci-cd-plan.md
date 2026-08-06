# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

Last updated: 2026-07-25

## Scope and intent

This plan defines the MeDoc pipeline in four tiers:

1. **Tier 1 — verify** (`.github/workflows/verify.yml`)
2. **Tier 2 — autofix** (`.github/workflows/autofix.yml`)
3. **Tier 3 — fix proposal** (`.github/workflows/fix-proposal.yml`)
4. **Tier 4 — release** (`.github/workflows/release.yml`)

The core rule is unchanged: **release gates verify, they do not mutate source**.

## Workspace truth used by the workflows

- Rust workspace root: `Cargo.toml` with members in `apps/*` and `crates/*`.
- JavaScript workspace root: `package.json` with workspace members in `apps/*` and `packages/*`.
- Legacy `app/src-tauri` and `app/` monolith assumptions are retired from active CI orchestration.

## Tier mapping

### Tier 1 — verify (blocking, zero mutation)

Trigger:

- `push` to `main`
- `pull_request`
- `workflow_call` (used by release gate)

Checks:

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`
- package-manager auto-detection (pnpm/yarn/npm) from lockfile
- frontend lint, typecheck, test, build (without any `--fix`)
- accessibility audit via axe on built UI (`npm run test:a11y`) with critical WCAG 2.1 A/AA as failure condition

Controls:

- workflow-level concurrency cancellation (`cancel-in-progress: true`)
- explicit job timeouts (`30m` / `20m`)

### Tier 2 — autofix (PR branches only, deterministic)

Trigger:

- `pull_request` only

Checks/fixes:

- `cargo fmt --all`
- `lint:fix` and `format` scripts (if present), no logic-changing commands
- commit/push only when tree changed

Controls:

- loop guard: `if: github.actor != 'github-actions[bot]'`
- never runs on `push` to `main`
- restricted path guard blocks bot commits that touch paths matching `security|audit|crypto|rbac`
- concurrency cancellation per PR head branch
- explicit timeout (`20m`)

### Tier 3 — fix proposal (draft PR, human merge)

Triggers:

- `workflow_dispatch` (manual)
- `workflow_run` when `verify` fails on `main`

Behavior:

- creates a **new proposal branch**
- captures failing-before evidence (`cargo test`, `cargo audit`, `typecheck`)
- attempts remediation with either:
  - configured `fix_command` input (or repository variable), or
  - baseline best-effort remediation command set
- captures passing-after evidence
- opens a **draft PR** only when a diff exists
- uploads before/after logs as workflow artifacts

Guardrails:

- no auto-merge behavior in workflow
- if proposal touches `security|audit|crypto|rbac`, label includes `needs-human-review`
- explicit timeout (`60m`) and concurrency cancellation

### Tier 4 — release (gated, reproducible, signed)

Triggers:

- `push` tags `v*`
- `workflow_dispatch`

Behavior:

- `gate` job reuses Tier 1 verify via `workflow_call`
- build runs only after gate success
- protected `release` environment is required (manual approval checkpoint)
- re-verifies `cargo test --workspace` on tagged commit
- builds signed Tauri bundles on Ubuntu/macOS/Windows
- uploads signed artifacts and emits provenance attestations

Controls:

- release jobs do not run fixers
- source tree is never mutated during release flow
- explicit timeout (`60m`) and concurrency cancellation

## Operational notes

- Root scripts used by CI:
  - `lint`, `lint:fix`, `format`, `typecheck`, `test`, `build`, `test:a11y`
- Accessibility command:
  - `apps/practice-host-ui/scripts/test-a11y.mjs` (Vite preview + axe-core, fail on critical violations only)

