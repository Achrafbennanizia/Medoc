# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

## Scope

- **Rust workspace:** `Cargo.toml` workspace members under `apps/*`, `crates/*`, `installer/*`
- **JS workspace:** root `package.json` workspaces under `apps/*`, `packages/*`, `website`
- **Workflow directory:** `.github/workflows/`

This plan enforces a verify-first pipeline where release artifacts are always built from reviewed commits and never from silently mutated sources.

## Tier map

| Tier | Workflow | Trigger | Mutation | Goal |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` (main), `pull_request`, reusable call | No | Blocking verification gate |
| 2 | `autofix.yml` | `pull_request` only | PR head branch only | Deterministic formatter/lint fixes |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, `workflow_run` failure on `verify` for `main` | New branch + draft PR | Substantive fix proposal with evidence |
| 4 | `release.yml` | tag `v*`, manual dispatch | No | Re-verify tagged commit, then signed release build |

## Guardrails

1. **Verify never mutates repository contents.**
2. **Autofix runs only on `pull_request` events**, with bot-loop guard (`github.actor != 'github-actions[bot]'`).
3. **Autofix is deterministic only:** `cargo fmt`, JS `lint:fix`, JS `format`.
4. **Fix proposals are always draft PRs**; never auto-merge.
5. **Sensitive areas are blocked for unattended approval:** if fix-proposal touches `security|audit|crypto|rbac|auth|permission|license` paths, apply `needs-human-review` and fail the run.
6. **Terminating runs:** each job has explicit timeout and workflow-level concurrency cancellation.
7. **Release reproducibility:** release re-runs verification and signs artifacts under protected `release` environment approval.

## Tier details

### Tier 1 — `verify.yml` (blocking gate)

- Rust:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS:
  - package manager auto-detected from lockfile (`pnpm`, `yarn`, `npm`)
  - `lint` (no `--fix`)
  - `typecheck`
  - `test`
  - `build`
- Accessibility:
  - `test:a11y` runs Playwright + axe-core against built UI
  - workflow fails on any **critical** WCAG 2.1 A/AA violation

### Tier 2 — `autofix.yml` (safe mutation on PR heads only)

- Runs on `pull_request` only.
- Skips bot-authored commits via loop guard.
- Applies deterministic fixes:
  - `cargo fmt --all`
  - `npm run lint:fix`
  - `npm run format`
- Commits and pushes only when `git status --porcelain` shows changes.

### Tier 3 — `fix-proposal.yml` (substantive proposal, human-reviewed)

- Triggered manually or automatically when `verify` fails on `main`.
- Creates a **new branch** from failing SHA/base ref.
- Captures before/after evidence for:
  - `cargo test --workspace`
  - `cargo audit`
  - JS `typecheck`
- Runs a configurable fix-agent command (`agent_command` input or `FIX_PROPOSAL_AGENT_COMMAND` secret).
- Opens a **draft PR** with:
  - rationale
  - before/after exit-code table
  - command log tails
- Applies and enforces `needs-human-review` label for sensitive touched paths.

### Tier 4 — `release.yml` (gated CD)

- Triggered by `v*` tags or manual dispatch.
- Calls Tier 1 verify as a reusable workflow (`uses: ./.github/workflows/verify.yml`).
- Builds signed Tauri bundles on Ubuntu/Windows/macOS under protected `release` environment.
- Validates tracked sources remain unchanged during build (`git diff --exit-code`).
- Uploads platform artifacts for release handling.

## Migration note

- Legacy `.github/workflows/ci.yml` is converted to a manual compatibility entrypoint (`ci-legacy-dispatch`) that reuses `verify.yml`.
- Active merge gate now lives in `verify.yml`, aligned to the live workspace layout.
