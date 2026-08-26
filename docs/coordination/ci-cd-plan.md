# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

## Scope

This plan implements a four-tier CI/CD model for the live repository layout:

- Rust workspace at repo root (`Cargo.toml`) with members under:
  - `apps/*`
  - `crates/*`
- JS workspace at repo root (`package.json`) with workspaces under:
  - `apps/*`
  - `packages/*`

The retired single-workflow model has been replaced by dedicated tier workflows in `.github/workflows/`.

## Tier map

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push` (main), `pull_request`, `workflow_call` | No | Blocking verification for Rust + JS + accessibility |
| 2 | `autofix.yml` | `pull_request` | PR branch only | Deterministic formatting / lint autofix |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` (`workflow_run`) | Opens draft PR only | Non-deterministic fix proposals with evidence |
| 4 | `release.yml` | `push` tags `v*`, `workflow_dispatch` | No | Re-verify + signed cross-platform release build in protected env |

## Guardrails (implemented)

1. **Verify is immutable**  
   `verify.yml` uses `cargo fmt --check`, no lint `--fix`, and build/test/audit only.

2. **Autofix is PR-only + loop guard**  
   `autofix.yml` runs only on `pull_request` and skips bot-authored runs via:
   `if: github.actor != 'github-actions[bot]'`.

3. **Deterministic-only autofix**  
   Tier 2 runs `cargo fmt`, `lint:fix`, and `format`; it commits only if diffs exist.

4. **Protected compliance paths are guarded**  
   Tier 2 reverts accidental autofix diffs in files matching security/audit/crypto/RBAC path patterns.
   Tier 3 labels draft PRs as `needs-human-review` when those paths are touched and exits without any auto-merge path.

5. **Terminating execution**  
   All workflows define `concurrency.cancel-in-progress: true` and per-job timeouts.

6. **Release is verify-only + gated approval**  
   `release.yml` calls `verify.yml` on the tag commit before build and runs build in protected environment `release`.
   Signed build uses `TAURI_SIGNING_PRIVATE_KEY` secrets and uploads artifacts only.

## Workflow details

### Tier 1 — `verify.yml`

- Rust job:
  - `cargo fmt --all -- --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS job:
  - Detect package manager from lockfile (`pnpm-lock.yaml` / `yarn.lock` / fallback `package-lock.json`)
  - Install dependencies with frozen/CI mode
  - Run: `lint`, `typecheck`, `test`, `build`
- A11y job:
  - Build UI
  - Run `test:a11y` (axe-core against built preview, failing on critical WCAG 2.1 A/AA violations)

### Tier 2 — `autofix.yml`

- Runs only for same-repo PR branches.
- Applies deterministic fixes (`cargo fmt`, `lint:fix`, `format`), commits, pushes to PR head branch.
- Guard step removes protected compliance file edits before commit.

### Tier 3 — `fix-proposal.yml`

- Triggered manually or automatically when `verify` fails on `main`.
- Runs verify-before and verify-after, executes a configured fix command, and opens a **draft PR** with:
  - commands used
  - exit-code evidence
  - changed-file list
- If protected paths are changed, adds `needs-human-review` and stops.

> Notes:
> - Manual runs require `fix_command` input.
> - Automatic runs require repository variable `CI_FIX_PROPOSAL_COMMAND`.
> - Optional variable `CI_FIX_PROPOSAL_VERIFY_COMMAND` overrides the default verify command.

### Tier 4 — `release.yml`

- Reuses `verify.yml` as gate (`workflow_call`) on tag/dispatch.
- After gate passes, matrix build on Linux/macOS/Windows under protected `release` environment.
- Builds signed Tauri bundles and uploads artifacts; source is not auto-fixed in release path.

## Required repository configuration

1. Protect `main` and require passing checks from `verify.yml`.
2. Configure protected environment `release` with required manual approvers.
3. Provide release signing secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
4. (Tier 3 auto mode) set repository variable:
   - `CI_FIX_PROPOSAL_COMMAND`
5. (Optional) set:
   - `CI_FIX_PROPOSAL_VERIFY_COMMAND`
