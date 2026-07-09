# MeDoc CI/CD plan — verify-first, safe autofix, gated release

**Last updated:** 2026-07-09  
**Scope:** `.github/workflows/{verify,autofix,fix-proposal,release}.yml` for the live workspace layout (`apps/*`, `crates/*`, `packages/*`).

## 1) Governing rule

Release gates verify the exact reviewed commit. They do not mutate source on protected or release paths.

- **Tier 1 (verify):** read-only checks on push/PR.
- **Tier 2 (autofix):** deterministic formatting/linting only, PR head branch only, bot-loop guard.
- **Tier 3 (fix-proposal):** proposal branch + draft PR, never auto-merge.
- **Tier 4 (release):** re-verify tagged commit, build signed artifacts under protected `release` environment.

## 2) Workspace detection (authoritative)

Evidence from repository manifests:

- Rust workspace members: `Cargo.toml` → `apps/practice-host`, `crates/*`.
- JS workspace members: root `package.json` → `apps/*`, `packages/*`.
- Legacy CI file to replace: `.github/workflows/ci.yml`.

## 3) Tier implementation map

### Tier 1 — `verify.yml` (blocking, zero mutation)

Triggers:

- `push` on `main`
- `pull_request`
- `workflow_call` (for release re-gating)

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- Web: package-manager detection (`pnpm`/`yarn`/`npm` by lockfile), install, lint (**no `--fix`**), typecheck, test, build.
- A11y: `test:a11y` script when present, otherwise fallback axe-core scan against built UI; fail on **critical** WCAG 2.1 A/AA violations.

Guardrails:

- Concurrency cancellation enabled.
- Per-job timeout configured.
- Verify jobs are strictly read-only.

### Tier 2 — `autofix.yml` (PR branches only)

Trigger:

- `pull_request` only (never `push` to `main`, never release).

Deterministic-only fixes:

- `cargo fmt --all`
- JS lint autofix (`lint:fix` when available, else deterministic ESLint `--fix`)
- optional formatter script (`format`) when available

Controls:

- Loop guard: skip if actor is `github-actions[bot]`.
- Same-repo PR guard before push-back to branch.
- Commit only when working tree changed.

### Tier 3 — `fix-proposal.yml` (manual or red `main`)

Triggers:

- `workflow_dispatch`
- `workflow_run` after `verify` completes with failure on `main`

Behavior:

- Captures failing-before verification snapshot.
- Runs configured fix agent command (`FIX_PROPOSAL_AGENT_CMD`) if provided.
- Captures passing-after snapshot.
- Opens a **draft PR** from a new `ci/fix-proposal-*` branch when a diff exists.
- Includes rationale + before/after evidence in PR body.

Sensitive-path policy:

- If diff touches `security|audit|crypto|rbac` paths (or `config/rbac.yaml`), add `needs-human-review`.
- Proposal remains draft; no auto-merge path exists.

### Tier 4 — `release.yml` (tag/dispatch, gated)

Triggers:

- `push` tag `v*`
- `workflow_dispatch`

Flow:

1. Re-run full `verify` on tagged commit (`workflow_call`).
2. Build matrix artifacts (`ubuntu`, `windows`, `macos`) in protected `release` environment.
3. Use Tauri signing key secrets during build.
4. Upload signed bundles and emit build provenance attestations.

Guarantees:

- No source mutation in release path.
- Human approval gate is enforced by protected environment policy.

## 4) Operational notes

- Branch protection should require Tier 1 `verify` checks as merge gates.
- Tier 2 is convenience only; if verify remains red after one autofix pass, human intervention or Tier 3 is required.
- Tier 3 proposals are advisory and auditable; merge authority stays with maintainers.
- Release signoff remains aligned with `docs/process/freigabeprozess.md`.
