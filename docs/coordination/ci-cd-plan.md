# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-08-26  
**Scope:** `.github/workflows/*` pipeline migration to active `crates/`, `apps/`, and `packages/` workspaces.

## Verified workspace targets

- Rust workspace is rooted at `/Cargo.toml` with members under:
  - `apps/practice-host`
  - `crates/app/*`
  - `crates/server/*`
  - `crates/shared/*`
  - `crates/test/*`
- JS workspace is rooted at `/package.json` with workspaces under:
  - `apps/*`
  - `packages/*`
- Lockfile currently present: `/package-lock.json` (npm), while pipeline remains lockfile-aware for pnpm/yarn.

## Pipeline rule of record

Release gates verify the exact reviewed commit and **must not mutate source**.

- Verify jobs: read-only checks only (pass/fail).
- Auto-fix jobs: deterministic, logic-free fixes only; PR branches only.
- Fix proposal jobs: open draft PRs for substantive fixes on a new branch; never auto-merge.
- Release jobs: verify + signed artifacts + human approval in protected `release` environment.

## Tier mapping

### Tier 1 — `verify.yml` (blocking)

Trigger:

- `push` (branches)
- `pull_request`
- reusable `workflow_call` (for release gate reuse)

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- Web: lockfile-based package manager detection (pnpm/yarn/npm), install, lint (no fix), type-check, test, build
- Accessibility: build UI and run axe-core scan against built output; fail on critical WCAG 2.1 A/AA violations

Guardrails:

- Concurrency cancellation enabled
- Per-job timeout set
- No `--fix` flags in verify jobs

### Tier 2 — `autofix.yml` (safe mutation, PR heads only)

Trigger:

- `pull_request`

Checks/actions:

- Loop guard: skip when actor is `github-actions[bot]`
- Deterministic fixes only:
  - `cargo fmt --all`
  - JS `lint:fix` (or deterministic eslint fallback)
  - JS `format` script when present
- Commit and push only when diff exists; commit returns to PR head branch and re-triggers verify

Guardrails:

- Never runs on `push` to `main`
- Never used in release path
- No non-deterministic or logic-changing automation

### Tier 3 — `fix-proposal.yml` (substantive fixes as draft PR)

Trigger:

- `workflow_dispatch`
- failed `verify` workflow on `main`

Checks/actions:

- Creates a new `ci/fix-proposal/*` branch
- Captures failing-before and passing-after evidence logs
- Runs operator-provided (or repository-configured) fix command
- Opens a **draft PR** with rationale and evidence
- If diff touches security/audit/crypto/RBAC surfaces, applies `needs-human-review` label

Guardrails:

- Never auto-merges
- No mutation on protected branches

### Tier 4 — `release.yml` (gated CD)

Trigger:

- tag push `v*`
- `workflow_dispatch`

Checks/actions:

- Re-runs full verify via reusable `verify.yml` gate job on tagged commit
- Builds signed cross-platform artifacts in protected `release` environment
- Uploads artifacts for auditable release outputs

Guardrails:

- No source mutation
- Manual approval required at environment gate
- Artifact provenance tied to tagged commit
