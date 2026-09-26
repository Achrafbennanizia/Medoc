# MeDoc CI/CD pipeline plan (verify + safe autofix + gated release)

**Last updated:** 2026-09-26  
**Scope:** `.github/workflows/{verify,autofix,fix-proposal,release}.yml`

## 1) Workspace truth (what CI validates)

The live repository layout is the workspace under:

- Rust: `Cargo.toml` workspace with members in `crates/*`, `apps/*`, and installer crates.
- JavaScript: npm/pnpm/yarn workspace packages in `apps/*` and `packages/*`.

Legacy `app/` assumptions are not used by the tiered gate workflows.

## 2) Tier model

| Tier | Workflow | Trigger | Mutates repository | Purpose |
|---|---|---|---|---|
| 1 | `verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | Blocking verification gate |
| 2 | `autofix.yml` | `pull_request` only | Yes (PR head branch only) | Deterministic lint/format fixes |
| 3 | `fix-proposal.yml` | Manual dispatch, or failed `verify` on `main` | No direct main mutation (draft PR only) | Proposal branch for substantive fixes |
| 4 | `release.yml` | Tag `v*` or manual dispatch | No | Re-verify + signed cross-platform build under approval gate |

## 3) Tier 1 (`verify.yml`) details

### Rust gate (zero mutation)

- `cargo fmt --all --check`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo test --workspace`
- `cargo audit`

### JS gate (zero mutation)

- Detects package manager from lockfile (`pnpm`, `yarn`, `npm`).
- Runs in the live JS workspace:
  - `apps/practice-host-ui`: `lint`, `typecheck`, tests, build
  - `apps/lan-web-client`: `typecheck`, build
- Uses `scripts/ci-frontend-test.sh` for deterministic frontend test execution.

### Accessibility gate

- Builds `apps/practice-host-ui`.
- Runs axe-core against the built UI.
- Fails only on **critical** WCAG 2.1 AA violations.

### Operational guardrails

- Workflow-level concurrency with `cancel-in-progress: true`.
- Per-job timeouts (`rust`, `web`, `a11y`).

## 4) Tier 2 (`autofix.yml`) details

- Runs on PR events only (never on `push` to protected branches).
- Loop guard: skips when actor is `github-actions[bot]`.
- Skips fork PR branches (no write token assumptions).
- Applies deterministic-only fixes:
  - `cargo fmt --all`
  - Workspace scripts `lint:fix` and `format` (if present)
- Commits back to PR head branch with bot identity and pushes once.

## 5) Tier 3 (`fix-proposal.yml`) details

- Triggered manually or when `verify` fails on `main`.
- Creates a **new branch** `ci/fix-proposal-<run-id>`.
- Attempts remediation (format/lint fixes + dependency-level audit remediations).
- Re-runs verification commands and records pass/fail evidence.
- Opens a **draft PR** via `peter-evans/create-pull-request`.
- If changed paths match security/audit/crypto/RBAC patterns:
  - Adds label `needs-human-review`
  - Stops automation after labeling.

Tier 3 never auto-merges.

## 6) Tier 4 (`release.yml`) details

- Triggered by `v*` tags or manual dispatch.
- Calls `verify.yml` as the release gate on the tagged commit (`workflow_call`).
- Build matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Runs under protected environment `release` (manual approval point).
- Re-verifies key checks, then builds signed Tauri bundles.
- Uploads build artifacts and records provenance attestation.

The release workflow verifies and signs only; it does not mutate source.

## 7) Additional notes

- `.github/workflows/ci.yml` is retained as a manual legacy entrypoint that dispatches `verify.yml`.
- Branch protection should target tier-1 verification checks (`verify` workflow jobs).
