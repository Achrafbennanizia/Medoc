# MeDoc CI/CD pipeline plan (verify + safe autofix + gated release)

**Last updated:** 2026-06-11  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Objectives

1. Verify the real workspace layout (`Cargo.toml` workspace + npm workspaces) on every push/PR.
2. Keep release artifacts reproducible from reviewed commits.
3. Allow only deterministic PR-branch autofixes.
4. Route non-deterministic fixes through draft PR proposals for human review.

## Workspace facts used by the pipeline

- Rust workspace root: `Cargo.toml` (members under `crates/*` and `apps/*`)
- JavaScript workspace root: `package.json` (workspaces under `apps/*` and `packages/*`)
- Package manager lockfile in repo: `package-lock.json` (pipeline still detects pnpm/yarn/npm)

## Tier mapping

| Tier | Workflow | Trigger | Repo mutation |
| --- | --- | --- | --- |
| 1. Verify | `verify.yml` | `push`, `pull_request`, reusable `workflow_call` | No |
| 2. Autofix | `autofix.yml` | `pull_request` only | Yes (PR head branch only) |
| 3. Fix proposal | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` (`workflow_run`) | New branch + draft PR proposal |
| 4. Release | `release.yml` | `push` tags `v*`, `workflow_dispatch` | No source mutation |

## Guardrails (enforced)

- Verify jobs do not run `--fix` and do not commit.
- Autofix is PR-only, with loop guard: `github.actor != 'github-actions[bot]'`.
- Autofix applies deterministic fixes only (`cargo fmt`, `lint:fix`, `format`), then commits to PR head branch.
- Tier 3 opens **draft** PRs only; never auto-merges.
- Sensitive paths (`security`, `audit`, `crypto`, `rbac`) are detected in Tier 3 and labeled `needs-human-review`; workflow halts afterward.
- All jobs use `timeout-minutes`.
- All workflows use `concurrency` with `cancel-in-progress: true`.
- Release uses protected `environment: release`, re-runs verify gate, signs artifacts, uploads artifacts + provenance attestation.

## Tier details

### Tier 1 — `verify.yml`

- Rust checks:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- Web checks (package-manager autodetected from lockfile):
  - install with frozen lock behavior (`pnpm/yarn`) or `npm ci`
  - `lint` (no `--fix`)
  - `typecheck`
  - `test`
  - `build`
- A11y:
  - installs Playwright Chromium
  - runs `test:a11y` (axe-core scan; fails on **critical** WCAG 2.1 A/AA issues)

### Tier 2 — `autofix.yml`

- Runs only on `pull_request`.
- Skips bot-authored commits (loop guard).
- Runs deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Commits only when working tree changed.

### Tier 3 — `fix-proposal.yml`

- Triggered manually or when `verify` fails on `main`.
- Creates a new proposal branch (`ci/fix-proposal-<run_id>`).
- Captures failing-before and passing-after evidence for:
  - `cargo test --workspace`
  - `cargo audit`
  - JS `typecheck`
- Runs optional non-deterministic agent hook via `CI_FIX_AGENT_COMMAND` (secret).
- Writes evidence under `docs/coordination/fix-proposals/`.
- Opens a **draft** PR with rationale + evidence + changed files.
- Applies `needs-human-review` and halts if sensitive code areas are touched.

### Tier 4 — `release.yml`

- Trigger: tags `v*` or manual dispatch.
- `gate` job calls reusable `verify.yml`.
- `build` job:
  - matrix: Linux / macOS / Windows
  - protected `release` environment (manual approval gate)
  - `cargo test --workspace` (verify-only; no autofix)
  - `tauri build` with signing secrets
  - uploads signed bundles
  - emits build provenance attestation

## Notes

- Legacy monolithic workflow `ci.yml` is superseded by the four-tier split.
- Tier 3 is explicitly proposal-based: it produces draft PRs and never self-merges.
