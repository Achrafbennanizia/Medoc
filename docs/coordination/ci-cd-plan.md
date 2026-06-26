# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

## Scope and intent

This plan defines a four-tier CI/CD pipeline for the live MeDoc workspace layout:

- Rust workspace at repository root (`Cargo.toml`) with members under `apps/*` and `crates/*`
- JS workspace at repository root (`package.json`) with workspaces under `apps/*` and `packages/*`

The release gate verifies and signs artifacts, but does not mutate source history.

## Workspace detection (verified)

- Rust workspace: `Cargo.toml` members include `apps/practice-host` and `crates/*`.
- JS workspace: root `package.json` workspaces include `apps/practice-host-ui`, `apps/lan-web-client`, and `packages/*`.
- Package manager detection: lockfile switch (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`/npm) in workflows.

## Tier map

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | Blocking verification (Rust + JS + a11y) |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | Yes (PR head branch only) | Deterministic formatting/lint fixes with loop guard |
| 3 | `.github/workflows/fix-proposal.yml` | Manual dispatch or failed `verify` on `main` | No direct main mutation; opens draft PR | Bounded fix attempt + evidence report + draft proposal PR |
| 4 | `.github/workflows/release.yml` | `v*` tag or manual dispatch | No | Re-run verify, then signed cross-platform build behind protected `release` environment |

## Guardrails

1. Verify tier never runs mutating commands.
2. Autofix runs on `pull_request` only, with loop guard:
   - `if: github.actor != 'github-actions[bot]'`
   - same-repo PR head restriction
3. Autofix commands are deterministic only:
   - `cargo fmt --all`
   - `lint:fix`
   - `format`
4. Tier 3 always opens **draft** PRs; never auto-merges.
5. Tier 3 labels proposals `needs-human-review` when changed paths match `security|audit|crypto|rbac`.
6. Concurrency cancellation and job timeouts are enabled across tiers.
7. Release uses a protected environment (`release`) and signs artifacts via `TAURI_SIGNING_PRIVATE_KEY`.

## Tier 1 verification profile

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- JS (`medoc` workspace package): lint (no `--fix`), typecheck, test, build
- Accessibility: `test:a11y` runs axe-core WCAG 2.1 AA checks and fails on critical issues

## Tier 2 autofix profile

- Triggered only on PR branches.
- Applies:
  - `cargo fmt --all`
  - `lint:fix`
  - `format`
- Commits and pushes only when there is a real diff.

## Tier 3 fix-proposal profile

- Trigger:
  - manual dispatch (`workflow_dispatch`)
  - failed `verify` on `main` (`workflow_run`)
- Captures failing-before and passing-after evidence (test/audit/typecheck exits).
- Writes proposal report under `docs/coordination/fix-proposals/`.
- Opens a draft PR on a new branch with rationale and evidence summary.

## Tier 4 release profile

- Reuses Tier 1 gate via workflow call (`uses: ./.github/workflows/verify.yml`).
- Builds signed bundles on Linux/macOS/Windows after gate passes.
- Uses protected `release` environment for manual approval.
- Uploads signed artifacts per OS.

## Paste-ready master command (section 7)

> Build the MeDoc CI/CD pipeline per `docs/coordination/ci-cd-plan.md`. The pipeline VERIFIES and gates; it must not silently rewrite code on protected or release paths. First detect the real workspace: the Rust cargo workspace under `crates/*` and `apps/*`, and the JS workspace under `apps/*` and `packages/*`. The existing `.github/workflows/ci.yml` targets retired paths; migrate CI to the live workspace without assuming legacy `app/` or `app/src-tauri` layouts.
>
> Create four tiers as separate workflows:
>
> - **Tier 1 `verify.yml`**: push+PR blocking verify, zero mutation; rust fmt/clippy/test/audit; JS lint/typecheck/test/build; axe-core critical WCAG 2.1 AA check; concurrency cancellation + timeouts.
> - **Tier 2 `autofix.yml`**: PR-only deterministic fixes (`cargo fmt`, `lint:fix`, `format`), commit to PR head branch, loop guard against bot recursion.
> - **Tier 3 `fix-proposal.yml`**: manual or failed-main trigger; bounded fix attempt on new branch; draft PR with rationale and failing-before/passing-after evidence; label `needs-human-review` when touching security/audit/crypto/RBAC paths.
> - **Tier 4 `release.yml`**: tag/dispatch trigger; rerun full verify; signed cross-platform artifacts in protected `release` environment; never mutate source.
