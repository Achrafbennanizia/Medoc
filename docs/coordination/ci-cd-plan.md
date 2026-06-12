# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

**Last updated:** 2026-06-12  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## 1) Workspace detection baseline (live repo, not legacy paths)

- **Rust workspace root:** `/Cargo.toml` with members in `apps/*` and `crates/*`.
- **JS workspace root:** `/package.json` with workspaces in `apps/*` and `packages/*`.
- **Legacy path migration:** monolithic `.github/workflows/ci.yml` removed; replaced by tiered workflows aligned to the root workspaces.

## 2) Tier model

| Tier | Workflow | Trigger | Mutates source? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | **No** | Blocking quality/security gate |
| 2 | `autofix.yml` | `pull_request` | **PR branch only** | Deterministic formatting/lint autofix |
| 3 | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | **New branch only** | Draft fix proposal PR with before/after evidence |
| 4 | `release.yml` | tag `v*` or `workflow_dispatch` | **No** | Re-verify + signed cross-platform build behind `release` environment approval |

## 3) Guardrails encoded in workflows

1. **Verify is mutation-free** (no `--fix` in Tier 1).
2. **Autofix runs on PR events only**, never on protected/release push paths.
3. **Autofix loop guard:** `github.actor != 'github-actions[bot]'`.
4. **Tier 2 deterministic-only scope:** `cargo fmt`, JS `lint:fix`, optional format script.
5. **Tier 3 safety signal:** if changed files include security/audit/crypto/RBAC paths, `needs-human-review` label is added and automation stops.
6. **Terminable execution:** workflow concurrency cancellation and per-job timeouts.
7. **Release reproducibility:** release reuses Tier 1 verification and builds signed artifacts from the tagged commit under protected `release` environment.

## 4) Tier details

### Tier 1 — `verify.yml`

- Rust checks:
  - `cargo fmt --all -- --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS checks:
  - package-manager autodetection via lockfile (`pnpm`, `yarn`, `npm`)
  - install + `lint` (no fix), `typecheck`, `test`, `build`
- Accessibility check:
  - builds UI
  - serves built app via `vite preview`
  - runs axe-core Playwright audit (`apps/practice-host-ui/scripts/run-a11y.mjs`)
  - fails on **critical** WCAG 2.1 A/AA violations

### Tier 2 — `autofix.yml`

- Trigger: `pull_request`.
- Deterministic fixes only:
  - `cargo fmt --all`
  - workspace lint autofix
  - optional format script
- Commits to PR head branch only when working tree changed.

### Tier 3 — `fix-proposal.yml`

- Triggered manually or when `verify` fails on `main`.
- Creates new branch `ci/fix-proposal-<run_id>`.
- Captures before/after evidence for:
  - `cargo test --workspace`
  - `cargo audit`
  - JS typecheck
- Writes report to:
  - `docs/coordination/fix-proposals/fix-proposal-<run_id>.md`
- Opens **draft** PR; never auto-merges.

### Tier 4 — `release.yml`

- Trigger: semver tags (`v*`) or manual dispatch.
- Re-runs full Tier 1 via reusable workflow call.
- Builds signed Tauri bundles on Linux/Windows/macOS in protected `release` environment.
- Uploads bundle artifacts per OS.
- Source tree is not mutated.

## 5) Compliance alignment

- Manual release approval and controlled signoff align with:
  - `docs/process/freigabeprozess.md` (IEC 62304 release control expectations).
- Signed release build path aligns with existing updater signing model (Ed25519 key material via CI secrets).
