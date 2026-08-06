# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

Last updated: 2026-07-26

## Goal

The pipeline verifies and gates merge/release quality without mutating protected history:

- **Tier 1 — verify:** blocking checks on push/PR, zero mutation.
- **Tier 2 — autofix:** deterministic format/lint fixes on PR branches only.
- **Tier 3 — fix-proposal:** branch-isolated draft PR proposals for non-deterministic failures.
- **Tier 4 — release:** verify gate + signed cross-platform build behind manual approval.

## Workspace truth used by workflows

- Rust workspace root: `Cargo.toml` with members under `apps/*`, `crates/*`.
- JS workspace root: `package.json` with workspaces under `apps/*`, `packages/*`.
- Legacy `app/src-tauri`/`app/` CI path assumptions are retired from the active workflows.

## Tier mapping

| Tier | Workflow | Trigger | Mutates repo | Notes |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | `cargo fmt --check`, clippy `-D warnings`, tests, `cargo audit`, JS lint/typecheck/test/build, axe critical WCAG check |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | PR branch only | Loop guard (`github.actor != github-actions[bot]`), deterministic fixes only |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | New proposal branch only | Opens **draft PR** with before/fix/after evidence; labels `needs-human-review` if sensitive paths touched |
| 4 | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No | Reuses verify as gate, then builds signed artifacts in protected `release` environment |

## Guardrails

1. Verify jobs do not use `--fix`.
2. Autofix never runs on `push` to `main` and is blocked on protected/release-like branch names.
3. Autofix loop guard avoids bot self-trigger loops.
4. Tier-2 fixes are limited to `cargo fmt`, eslint `--fix`, and `format` script.
5. Tier-3 sensitive-path proposals (`security`/`audit`/`crypto`/`rbac`) are labeled `needs-human-review` and the run is stopped for manual adjudication.
6. All jobs have explicit `timeout-minutes`; workflow concurrency cancels superseded runs.
7. Release uses the tagged commit as input, performs verify/build/sign only, and requires manual environment approval.

## Accessibility gate implementation

- Script: `scripts/ci/run-axe-critical.mjs`
- Engine: `@axe-core/playwright`
- Mode: fail only on **critical** WCAG 2.1 A/AA violations against the built preview UI.

## Follow-up checks after this migration

1. Run the four workflows once in GitHub Actions to validate runner dependencies per OS.
2. Confirm the protected `release` environment approval policy is configured.
3. Confirm required secrets exist for release signing (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
