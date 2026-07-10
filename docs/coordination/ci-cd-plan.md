# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Scope

This plan wires GitHub Actions for the active workspace layout:

- Rust workspace: `Cargo.toml` + `crates/*` + `apps/*`
- JS workspace: root `package.json` + `apps/*` + `packages/*`

The pipeline verifies and gates merges/releases. It only mutates pull-request
head branches for deterministic formatter/linter fixes.

## Tier map

| Tier | Workflow | Trigger | Mutates repo | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking verify: Rust + JS + a11y |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | PR head only | Deterministic `cargo fmt` + lint/format autofix |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | New branch only | Agent-driven draft fix proposal PR |
| 4 | `.github/workflows/release.yml` | tag `v*`, `workflow_dispatch` | No source mutation | Re-run verify, protected release build/sign/upload |

## Guardrails

1. **Verify is read-only.** `verify.yml` runs checks only (`--check` / no `--fix`).
2. **Autofix is PR-only.** No run on protected branch pushes or release paths.
3. **Loop guard is active.** Autofix skips bot-authored commits and bot actor runs.
4. **Tier 2 stays deterministic.** Only formatter/linter autofixes are attempted.
5. **Restricted code is blocked in tier 2.** If changed paths match
   `security|audit|crypto|rbac`, the job fails before commit.
6. **Tier 3 proposals are draft PRs only.** Never auto-merge.
7. **Sensitive tier 3 changes are labeled.** `needs-human-review` is applied when
   security/audit/crypto/RBAC paths are touched.
8. **Termination controls are set.** All jobs use `timeout-minutes`; workflow
   concurrency cancels superseded runs where applicable.
9. **Release is reproducible and signed.** `release.yml` gates on full verify, runs
   under protected `release` environment approval, signs bundles, and fails if the
   source tree mutates during build.

## Verify checks in tier 1

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace`, `cargo audit`
- Web: package-manager auto-detect (`pnpm`/`yarn`/`npm`), then lint, typecheck, test, build
- Accessibility: build UI, run `axe-core` against preview server, fail on critical
  WCAG 2.1 AA violations (`scripts/check-axe-critical.mjs`)

## Release gate details (tier 4)

- `gate` job calls `verify.yml` on the tagged commit (`workflow_call`)
- Manual approval enforced via `environment: release`
- Cross-platform signed artifacts built for Linux/macOS/Windows
- Artifact provenance attestation emitted in CI
