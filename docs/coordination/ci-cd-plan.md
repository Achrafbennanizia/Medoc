# MeDoc CI/CD plan — verify, safe autofix, gated release

**Last updated:** 2026-08-25  
**Scope:** GitHub Actions workflows under `.github/workflows/`

## Verified workspace targets

- Rust workspace root is `Cargo.toml` with members under `crates/*` and `apps/*`.
- JS workspace root is `package.json` with workspaces under `apps/*` and `packages/*`.
- Legacy `app/src-tauri` and `app/` CI assumptions are retired for active pipeline flows.

## Pipeline tiers

| Tier | Workflow | Trigger | Mutates source? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` to `main`, `pull_request`, `workflow_call` | No | Blocking verification gate (Rust + Web + a11y) |
| 2 | `autofix.yml` | `pull_request` | Yes, PR head branch only | Deterministic formatter/lint fixes with loop guard |
| 3 | `fix-proposal.yml` | `workflow_dispatch` and failed `verify` on `main` push | No direct protected-branch mutation; opens draft PR | Non-deterministic remediation proposal with before/after evidence |
| 4 | `release.yml` | tag `v*`, `workflow_dispatch` | No | Reuse verify gate, then signed cross-platform build in protected `release` environment |

## Guardrails implemented

1. **Verify never mutates source.**
2. **Autofix runs only on PRs** and is blocked for bot-authored commits (`github-actions[bot]`) to prevent fix loops.
3. **Autofix only applies deterministic commands** (`cargo fmt`, lint/format fix scripts when present).
4. **Fix proposals open draft PRs only** (no auto-merge path).
5. **Sensitive change guard in tier 3:** proposals touching security/audit/crypto/RBAC-style paths are labeled `needs-human-review` and the workflow stops.
6. **All jobs are terminable** via explicit `timeout-minutes` and `concurrency.cancel-in-progress`.
7. **Release is verification + signing only** on tagged commit under protected environment approval.

## Workflow files

- `.github/workflows/verify.yml`
- `.github/workflows/autofix.yml`
- `.github/workflows/fix-proposal.yml`
- `.github/workflows/release.yml`
