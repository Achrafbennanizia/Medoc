# MeDoc CI/CD pipeline plan (verify-first, safe autofix, gated release)

**Status:** implemented in `.github/workflows/{verify,autofix,fix-proposal,release}.yml`  
**Scope:** Rust workspace (`Cargo.toml` members under `apps/` + `crates/`) and JS workspace (`package.json` workspaces under `apps/` + `packages/`).

## Workspace detection (verified)

- Rust workspace root: `Cargo.toml` with members in `apps/practice-host` and `crates/*`.
- JS workspace root: `package.json` workspaces:
  - `apps/practice-host-ui`
  - `apps/lan-web-client`
  - `packages/*`
- Package manager lockfile detection in workflows:
  - `pnpm-lock.yaml` -> pnpm
  - `yarn.lock` -> yarn
  - `package-lock.json` -> npm

## Tier 1 — `verify.yml` (blocking, zero mutation)

Trigger:
- every push
- every pull request
- reusable via `workflow_call` (for release gate)

Checks:
- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`
- Web: install via detected package manager, then `lint`, `typecheck`, `test`, `build` (no `--fix`)
- A11y: build UI and run `npm run test:a11y` (axe-core, WCAG 2.1 A/AA tags, fail on `critical` impact)

Guardrails:
- `concurrency.cancel-in-progress: true`
- per-job `timeout-minutes`
- no mutation commands in verify jobs

## Tier 2 — `autofix.yml` (PR branches only, deterministic-only)

Trigger:
- `pull_request` only

Flow:
- loop guard: skip when `github.actor == 'github-actions[bot]'`
- run deterministic fixes only:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- commit and push back to PR head branch only when there is a diff

Guardrails:
- never runs on `push` to protected branches
- no release-path execution
- no retry loops; timeout + concurrency cancellation enabled

## Tier 3 — `fix-proposal.yml` (non-deterministic proposals via draft PR)

Trigger:
- manual `workflow_dispatch`
- automatic on failed `verify` run on `main` (`workflow_run`)

Flow:
- create evidence logs (failing-before, fix attempt, passing-after)
- run configurable fix command (`inputs.fix_command` or `vars.CI_FIX_PROPOSAL_COMMAND`)
- fallback heuristic when no external agent command is provided:
  - `cargo fix --workspace --all-targets --allow-dirty --allow-staged || true`
  - `npm run typecheck || true`
  - `cargo audit || true`
- open **draft** PR with evidence report (`.ci/fix-proposal/report.md`)

Sensitive-scope rule:
- if proposed diff touches paths matching `security|audit|crypto|rbac`, apply `needs-human-review` label and stop.

## Tier 4 — `release.yml` (gated, reproducible, signed)

Trigger:
- tag push `v*`
- manual `workflow_dispatch`

Flow:
1. `gate` job re-runs full verify via reusable workflow (`uses: ./.github/workflows/verify.yml`)
2. `build` job (matrix: Linux, Windows, macOS) runs under protected `environment: release`
3. re-verifies tests on tagged commit (`cargo test --workspace --tests`)
4. builds signed artifacts (`tauri build`) with signing key secrets
5. uploads bundles from `apps/practice-host-ui/src-tauri/target/release/bundle/**`

Guardrails:
- release path has no source mutation
- concurrency + timeout applied
- manual environment approval is the human gate

## Supporting scripts for pipeline commands

Added workspace scripts:
- Root `package.json`: `typecheck`, `lint:fix`, `format`, `test:a11y`
- `apps/practice-host-ui/package.json`: `typecheck`, `lint:fix`, `format`, `test:a11y`
- `apps/practice-host-ui/scripts/test-a11y.mjs`: Playwright + axe-core runner (critical WCAG 2.1 A/AA only)
