# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Purpose

This pipeline enforces a single rule: **release gates verify, they do not mutate source**.

- Tier 1 verifies every commit (blocking).
- Tier 2 applies deterministic autofixes only on pull-request head branches.
- Tier 3 proposes non-deterministic fixes in a draft PR for human review.
- Tier 4 releases only from a verified commit under manual approval.

## Workspace detection and migration baseline

The repository layout used by workflows is:

- Rust workspace: repo-root `Cargo.toml` with members under `apps/*`, `crates/*`, `installer/*`.
- JS workspace: repo-root `package.json` with workspace packages under `apps/*`, `packages/*`, `website`.
- Package manager detection: `pnpm-lock.yaml` -> `pnpm`, `yarn.lock` -> `yarn`, else `package-lock.json` -> `npm`.

The former `ci.yml` logic was migrated to this tiered setup:

- `.github/workflows/verify.yml` (tier 1, canonical verifier)
- `.github/workflows/autofix.yml` (tier 2)
- `.github/workflows/fix-proposal.yml` (tier 3)
- `.github/workflows/release.yml` (tier 4)
- `.github/workflows/ci.yml` now acts as a compatibility shim that calls `verify.yml`.

## Tier 1 - verify (`verify.yml`)

Triggers:

- `push` to `main`
- `pull_request`
- `workflow_call` (used by release gate and compatibility callers)

Rules:

- No mutation steps.
- `concurrency.cancel-in-progress: true`.
- Per-job timeouts.

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- JS: `lint` (without `--fix`), `typecheck`, `test`, `build`.
- Accessibility: runs axe-core against built UI and fails on **critical** WCAG 2.1 A/AA violations.

## Tier 2 - autofix (`autofix.yml`)

Trigger:

- `pull_request` only.

Rules:

- Never runs on `push` to `main` or tags.
- Loop guard: job-level `if: github.actor != 'github-actions[bot]'`.
- Skips fork PR branches (`head.repo.full_name == github.repository`) to avoid unsafe push attempts.
- Compliance guard: if diffs include `security|audit|crypto|rbac`, the job fails and does not commit.
- Deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`

Behavior:

- Commits back only when there is an actual diff.
- Lets tier-1 verify rerun on the updated PR head.

## Tier 3 - fix proposal (`fix-proposal.yml`)

Triggers:

- Manual `workflow_dispatch`.
- `workflow_run` when `verify` fails on `main`.

Behavior:

- Runs baseline checks (tests/audit/typecheck), then executes a configurable fix command (`MEDOC_FIX_PROPOSAL_COMMAND` repository variable or workflow input override), reruns checks, and opens a **draft PR** with before/after evidence.
- Never auto-merges.
- If changed files match `security|audit|crypto|rbac`, applies `needs-human-review` label.

## Tier 4 - release (`release.yml`)

Triggers:

- Tag push `v*`
- Manual `workflow_dispatch`

Behavior:

- Calls tier-1 `verify.yml` as a release gate.
- Builds signed bundles on `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Runs under protected `environment: release` (manual approval gate).
- Uploads signed artifacts only; no source mutation.

## Guardrails enforced across tiers

1. Verify never mutates source.
2. Autofix is PR-only and deterministic.
3. No retry loops; superseded runs are canceled by concurrency groups.
4. Tier 3 remains draft-only and human-reviewed.
5. Release path verifies and signs from the checked-out commit only.

## Required repository settings

- Configure protected `release` environment with manual approvals.
- Add signing secrets:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (if key is passphrase-protected)
- Optionally set repository variable for tier-3 fixer:
  - `MEDOC_FIX_PROPOSAL_COMMAND`
