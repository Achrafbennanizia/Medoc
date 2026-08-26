# MeDoc CI/CD plan (verify, safe autofix, gated release)

Last updated: 2026-08-26

## Verified workspace shape

- Rust workspace is rooted at `Cargo.toml` and includes `apps/practice-host`, `crates/*`, and `crates/test/*`.
- JavaScript workspace is rooted at `package.json` and includes `apps/*` and `packages/*`.
- Active workflows now live under `.github/workflows/`.

Evidence:

- `Cargo.toml` workspace members list (`apps/practice-host`, `crates/server/*`, `crates/shared/*`, `crates/test/medoc-e2e`).
- Root `package.json` workspaces list (`apps/practice-host-ui`, `apps/lan-web-client`, `packages/*`).

## Tier layout

| Tier | Workflow | Trigger | Mutates repo | Role |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking verification gate |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | Yes (PR head branch only) | Deterministic formatter/linter fixes |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | No direct protected-branch mutation | Draft PR proposal for substantive fixes |
| 4 | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No | Re-verify + signed gated release builds |

## Guardrails applied

1. Verify jobs never use `--fix` and never commit.
2. Autofix runs only on `pull_request`, with loop guard:
   - `if: github.actor != 'github-actions[bot]'`
   - same-repo head branch only (`github.event.pull_request.head.repo.full_name == github.repository`)
3. Autofix scope is deterministic only:
   - `cargo fmt --all`
   - `lint:fix`
   - `format`
4. Fix proposals run on a new branch (`ci/fix-proposal-<run_id>`) and open draft PRs.
5. Sensitive path touches (security/audit/crypto/RBAC) in tier 3 are labeled `needs-human-review` and stop the run.
6. Concurrency cancellation and per-job timeouts are configured on all tiers.
7. Release uses protected `release` environment and signs artifacts from the reviewed tag commit.

## Tier 1 command contract

### Rust

- `cargo fmt --all -- --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace --tests`
- `cargo audit`

### Web

Package manager is detected from lockfile (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`):

- install (`pnpm install --frozen-lockfile` / `yarn install --frozen-lockfile` / `npm ci`)
- `lint`
- `typecheck`
- `test`
- `build`

### Accessibility

- `npx playwright install --with-deps chromium`
- build UI
- run axe-core scan script (`test:a11y`) and fail on critical WCAG 2.1 A/AA violations only.

## Tier 3 proposal behavior

`fix-proposal.yml` records:

- failing-before command + exit code
- fix command + exit code
- passing-after command + exit code
- changed files

It opens a draft PR with this evidence and rationale. No auto-merge path is configured.

## Release gate model

`release.yml`:

1. Calls `verify.yml` as a reusable workflow on the tagged commit.
2. Runs signed Tauri builds on `ubuntu-latest`, `windows-latest`, and `macos-latest`.
3. Requires protected `release` environment approval.
4. Uploads artifacts and emits provenance attestations.
