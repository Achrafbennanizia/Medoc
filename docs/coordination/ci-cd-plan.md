# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

Last updated: 2026-08-25

## Objective

The CI/CD pipeline verifies and gates merges/releases for the live MeDoc workspace layout:

- Rust workspace: `Cargo.toml` with members under `apps/*` and `crates/*`
- JavaScript workspace: root `package.json` with workspaces under `apps/*` and `packages/*`

Release gating is verification-first: the shipped artifact must be built from the reviewed tag commit without source mutation.

## Tier model

| Tier | Workflow | Trigger | Mutates repository |
| --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | Yes, PR head branch only |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | Yes, draft proposal branch only |
| 4 | `.github/workflows/release.yml` | tag `v*` or `workflow_dispatch` | No |

## Guardrails

1. **Verify is non-mutating** (`fmt --check`, no linter fixes in Tier 1).
2. **Autofix is PR-only**, guarded by `if: github.actor != 'github-actions[bot]'` and same-repo PR scope.
3. **Deterministic-only autofix** in Tier 2 (`cargo fmt`, `lint:fix`, `format`).
4. **Substantive remediation is draft-PR only** in Tier 3 (never auto-merge).
5. **Sensitive paths** (`security|audit|crypto|rbac`) are automation-restricted:
   - Tier 2 autofix refuses to push when deterministic fixes touch these paths.
   - Tier 3 applies `needs-human-review` and stops after opening the draft proposal PR.
6. **All jobs terminate** with explicit `timeout-minutes` and `concurrency.cancel-in-progress: true`.
7. **Release is gated and reproducible**: verify reruns via reusable workflow, then signed artifacts are built in protected `release` environment.

## Tier implementation summary

### Tier 1 — verify

`verify.yml` executes:

- Rust: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`.
- Web: package-manager autodetection (`pnpm`/`yarn`/`npm`), `lint`, `typecheck`, `test`, `build`.
- Accessibility: `test:a11y` runs axe-core against built UI and fails on critical WCAG 2.1 A/AA violations.

### Tier 2 — autofix

`autofix.yml` runs only on pull requests and only for non-bot actors:

- Rust deterministic formatting: `cargo fmt --all`
- JS deterministic fixes: `lint:fix`, `format`
- Commits and pushes changes back to PR head branch.

### Tier 3 — fix proposal

`fix-proposal.yml` supports:

- Manual dispatch with explicit `fix_command` and `verify_command`.
- Auto-trigger when `verify` fails on `main`.
- Captures failing-before and passing-after evidence logs.
- Opens a **draft PR** from a new proposal branch when changes are produced.

### Tier 4 — release

`release.yml`:

- Runs `gate` by reusing `verify.yml` through `workflow_call`.
- Builds signed cross-platform bundles only after gate success.
- Uses protected `release` environment as human approval checkpoint.
- Uploads release artifacts without mutating source.

## Notes

- The legacy monolithic `.github/workflows/ci.yml` is retired in favor of tiered workflows.
- JS script entrypoints used by CI are defined in root `package.json` and `apps/practice-host-ui/package.json` (`typecheck`, `lint:fix`, `format`, `test:a11y`).
