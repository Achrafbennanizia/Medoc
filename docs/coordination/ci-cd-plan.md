# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

**Last updated:** 2026-09-26  
**Scope:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`, and `ci.yml` compatibility shim.

## Goal

Gate merges and releases by **verification first**. Any mutation is constrained to PR head branches for deterministic formatting/lint fixes only. Release paths never mutate source.

## Real workspace mapping

- **Rust workspace:** root `Cargo.toml` members under `apps/*` and `crates/*`.
- **JS workspace:** root npm workspaces under `apps/*` and `packages/*`.
- **Retired CI behavior:** old monolithic `ci.yml` replaced by a manual `ci-legacy-shim` and tiered workflows below.

## Tier 1 — `verify.yml` (blocking, zero mutation)

**Triggers:** `push` to `main`, all `pull_request`, and `workflow_call` (for release gate reuse).

### Rust job

- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`

### Web job

- Detect package manager from lockfile (`pnpm`/`yarn`/`npm`)
- Install with lockfile discipline
- Lint without fix
- Typecheck (`medoc` + `medoc-lan-web-client`)
- Unit tests
- Build

### A11y job

- Build web UI
- Install Chromium for Playwright
- Run `axe-core` scan against built UI preview (`scripts/ci-a11y-check.mjs`)
- Fail only on **critical** WCAG 2.1 A/AA violations

### Shared guardrails

- `concurrency.cancel-in-progress: true`
- Job timeouts on all jobs
- No `--fix` in verify

## Tier 2 — `autofix.yml` (PR-only deterministic fixes)

**Trigger:** `pull_request` only.

- Loop guard: skip when actor is `github-actions[bot]`
- Additional guard: skip fork PRs (no cross-repo mutation)
- Deterministic actions only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Commit/push back only if tree changed
- No run on `push` to protected branches or release flows

## Tier 3 — `fix-proposal.yml` (draft PR proposals, never auto-merge)

**Triggers:**

- `workflow_dispatch` (manual)
- `workflow_run` when `verify` fails on `main`

### Behavior

- Creates a **new proposal branch**
- Captures failing-before and passing-after command evidence
- Runs a substantive repair command (manual input or default advisory attempt on red `main`)
- Opens a **draft PR** with rationale and evidence
- Uploads evidence artifacts (`.ci-evidence/*`)
- Never auto-merges

### Compliance stop

- If proposal diff touches security/audit/crypto/RBAC paths, apply `needs-human-review` and fail the workflow for mandatory human review.

## Tier 4 — `release.yml` (gated, signed, zero mutation)

**Triggers:** tags `v*` and `workflow_dispatch`.

- Reuses full `verify.yml` via `workflow_call`
- Builds only after verify gate passes
- Runs in protected `release` environment (manual approval)
- Verifies/tests tagged commit and builds signed artifacts (`TAURI_SIGNING_PRIVATE_KEY*`)
- Uploads bundles from `apps/practice-host/target/release/bundle/**/*`
- No source mutation in release path

## Branch-protection recommendations

Mark Tier 1 jobs (`rust`, `web`, `a11y`) as required checks for merge gating. Keep Tier 2/3 non-blocking for merge policy unless your governance requires proposal automation success.
