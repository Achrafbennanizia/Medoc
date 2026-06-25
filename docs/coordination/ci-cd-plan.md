# MeDoc CI/CD pipeline plan (verify-first, safe autofix, gated release)

## Scope

This pipeline enforces **verification-first** delivery for the live workspace layout:

- Rust workspace: `Cargo.toml` members under `apps/*` and `crates/*`
- JS workspace: root `package.json` workspaces under `apps/*` and `packages/*`

The retired `app/src-tauri` and `app/` CI paths are replaced by root-workspace workflows in `.github/workflows/`.

## Tier map

| Tier | Workflow | Trigger | Repo mutation |
| ---- | -------- | ------- | ------------- |
| 1 | `.github/workflows/verify.yml` | every push + PR (+ reusable `workflow_call`) | **No** |
| 2 | `.github/workflows/autofix.yml` | `pull_request` only | **Yes (PR head only)** |
| 3 | `.github/workflows/fix-proposal.yml` | manual dispatch or failed `verify` on `main` | **Yes (new proposal branch + draft PR)** |
| 4 | `.github/workflows/release.yml` | tag `v*` or manual dispatch | **No source mutation** |

## Guardrails

1. **Verify is immutable**: lint/typecheck/test/build/audit only; no `--fix`.
2. **Autofix is PR-only**: never runs on `push`/release paths.
3. **Loop guard enabled**: autofix job skips bot-authored runs (`github-actions[bot]`).
4. **Deterministic autofix only**: `cargo fmt`, `lint:fix`, `format`.
5. **Restricted-code protection** (Tier 3): changes touching `security|audit|crypto|rbac` are labeled `needs-human-review` and halted.
6. **Termination controls**: each workflow uses `concurrency.cancel-in-progress`; each job has `timeout-minutes`.
7. **Release reproducibility**: release job re-runs full verify on tagged commit via reusable workflow, builds signed artifacts in protected `release` environment, and publishes provenance attestation.

## Notes on package manager handling

`verify.yml`, `autofix.yml`, `fix-proposal.yml`, and `release.yml` detect package manager by lockfile:

- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` → npm

No workflow hardcodes npm when selecting install/cache commands.

## Accessibility gate

Tier 1 includes an axe-core gate (`scripts/test-a11y.sh`) that:

1. Builds the web UI.
2. Serves the built app in preview mode.
3. Runs `@axe-core/cli` with WCAG 2.1 A/AA tags.
4. Fails the job on any **critical** violation.
