# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-25  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## 1) Non-negotiable release rule

Release gates verify artifacts; they do not mutate source.

- Verify jobs never run `--fix` and never commit.
- Auto-fix runs only on pull-request branches, only deterministic format/lint actions.
- Non-deterministic fixes are proposal-only (draft PR), never auto-merged.
- Release builds are manual-gated, signed, and built from the reviewed/tagged commit.

## 2) Live workspace detection (authoritative paths)

Detected from repository files:

- Rust workspace: `Cargo.toml` members under `apps/*` and `crates/*`.
- JavaScript workspace: root `package.json` workspaces under `apps/*` and `packages/*`.
- Package manager lockfile at root: `package-lock.json` (with generic pnpm/yarn/npm detection in workflows).

The legacy single-file CI (`.github/workflows/ci.yml`) was retired and replaced by tiered workflows aligned to this layout.

## 3) Tier map

| Tier | Workflow | Trigger | Repo mutation | Purpose |
|---|---|---|---:|---|
| 1 | `verify.yml` | `push` to `main`, `pull_request`, reusable `workflow_call` | No | Blocking verification (Rust/Web/A11y) |
| 2 | `autofix.yml` | `pull_request` only | PR head branch only | Deterministic formatting/lint fixes |
| 3 | `fix-proposal.yml` | manual dispatch or failed `verify` on `main` | New proposal branch only | Attempt real fix, open draft PR with evidence |
| 4 | `release.yml` | `push` tag `v*`, `workflow_dispatch` | No | Re-verify + signed cross-platform artifacts under protected `release` env |

## 4) Guardrails implemented

1. **Verify never mutates**
   - `verify.yml` runs checks only (`cargo fmt --check`, clippy, tests, audit, lint/typecheck/test/build, axe audit).
2. **Auto-fix restricted to PR branches**
   - `autofix.yml` uses `on: pull_request` only.
3. **Loop guard**
   - `autofix.yml` job condition blocks bot recursion: `github.actor != 'github-actions[bot]'`.
4. **Deterministic fixes only**
   - `cargo fmt`, `lint:fix`, `format` only.
5. **Protected surfaces off-limits**
   - Tier 2 and Tier 3 detect changed files matching security/audit/crypto/RBAC patterns and stop.
   - Tier 3 applies `needs-human-review` label if touched.
6. **Termination controls**
   - Every job has `timeout-minutes`.
   - Every workflow has `concurrency` with `cancel-in-progress: true`.
7. **Reproducible release**
   - Tier 4 gates through reusable `verify.yml`, requires protected `release` environment approval, signs Tauri artifacts, and asserts tracked source remains unchanged.

## 5) Notes on Tier 3 operation

`fix-proposal.yml` enforces evidence:

- Captures failing-before verification output.
- Runs an explicit fix command (`fix_command` input or repository variable `CI_FIX_PROPOSAL_COMMAND`).
- Requires passing-after verification output.
- Requires a real source diff.
- Opens a **draft PR** with rationale + before/after logs.

If no fix command is provided, the workflow fails fast rather than making unsafe guesses.

## 6) Related files

- `.github/workflows/verify.yml`
- `.github/workflows/autofix.yml`
- `.github/workflows/fix-proposal.yml`
- `.github/workflows/release.yml`
- `apps/practice-host-ui/scripts/test-a11y.mjs`
- `package.json`
- `apps/practice-host-ui/package.json`
