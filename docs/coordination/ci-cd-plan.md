# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-26  
**Scope:** GitHub Actions workflows under `.github/workflows/` for the live workspace layout.

## Workspace detection baseline

- **Rust workspace root:** `Cargo.toml` at repository root, members under `apps/*` and `crates/*`.
- **JS workspace root:** `package.json` at repository root, workspaces under `apps/*` and `packages/*`.
- **Live apps validated by CI:** `apps/practice-host-ui` (`medoc`) and `apps/lan-web-client` (`medoc-lan-web-client`).
- **Package manager detection rule:** lockfile-driven (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm).

## Tier map

| Tier | Workflow | Trigger | Mutates repository? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking verification: Rust + JS + accessibility |
| 2 | `autofix.yml` | `pull_request` | Yes, PR head only | Deterministic formatting/lint fixes |
| 3 | `fix-proposal.yml` | `workflow_dispatch` or failed `verify` on `main` | No direct mutation of protected branches | Agent-like fix attempt on new branch + draft PR |
| 4 | `release.yml` | tag `v*` or manual dispatch | No source mutation | Re-verify + signed cross-platform build behind release approval |

## Guardrails implemented

1. **Verify is read-only:** no `--fix` in `verify.yml`.
2. **Auto-fix is PR-only:** `autofix.yml` runs only on `pull_request`, never on `push` to `main`.
3. **Loop guard:** `autofix.yml` has `if: github.actor != 'github-actions[bot]'`.
4. **Deterministic auto-fix scope:** tier 2 runs `cargo fmt`, `lint:fix`, `format` only.
5. **Sensitive-code handling in tier 3:** if proposed diff touches `security|audit|crypto|rbac` paths, workflow labels PR `needs-human-review` and stops.
6. **Terminable workflows:** all jobs have explicit `timeout-minutes`; all workflows use concurrency cancel-in-progress.
7. **Release reproducibility:** `release.yml` re-runs tier-1 via `workflow_call` on the tagged commit and builds signed artifacts in protected `release` environment.

## Workflow files

- `.github/workflows/verify.yml`
- `.github/workflows/autofix.yml`
- `.github/workflows/fix-proposal.yml`
- `.github/workflows/release.yml`

## Accessibility gate detail

- `verify.yml` `a11y` job builds `medoc`, serves the built UI with `vite preview`, runs axe CLI against the built page, and enforces failure only for **critical** WCAG A/AA findings.
- Parser script: `scripts/assert-axe-critical.mjs`

## Notes

- The legacy workflow `.github/workflows/ci.yml` was retired in favor of explicit tiered workflows.
- Tier 3 always opens a **draft** PR; no auto-merge behavior is configured.
