# MeDoc CI/CD pipeline plan (verify-first, gated release)

**Last updated:** 2026-08-26  
**Scope:** GitHub Actions workflows under `.github/workflows/` for tiered CI/CD execution.

## Pipeline rule

Release gates verify and sign; they do not mutate source. The artifact that ships must match the reviewed commit/tag.

## Tier map

| Tier | Workflow | Trigger | Mutates repository | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking checks: Rust fmt/clippy/test/audit, web lint/typecheck/test/build, axe critical WCAG gate |
| 2 | `autofix.yml` | `pull_request` | Yes (PR head branch only) | Deterministic fixes only (`cargo fmt`, lint/format scripts), commit back, then re-run verify |
| 3 | `fix-proposal.yml` | Manual dispatch or failed `verify` on `main` | No direct merge; opens draft PR | Agent-style fix proposal with evidence report; labels sensitive-path diffs for human review |
| 4 | `release.yml` | tag `v*` or manual dispatch | No | Re-run verify gate, then signed cross-platform build behind protected `release` environment |

## Guardrails

1. Verify tier never uses `--fix` or commits changes.
2. Auto-fix tier is pull-request only and blocked when actor is `github-actions[bot]` (loop guard).
3. Auto-fix applies deterministic formatting/linting only.
4. Fix proposals are always draft PRs; no auto-merge.
5. Sensitive paths (`security`, `audit`, `crypto`, `rbac`) in fix-proposal diffs are labeled `needs-human-review`.
6. Concurrency and timeout limits are set per workflow/job to terminate superseded or hung runs.
7. Release artifacts are produced from the gated commit/tag and signed via Tauri signing secrets.

## Workspace assumptions

- Rust workspace rooted at `Cargo.toml` with members across `apps/*` and `crates/*`.
- JS workspace rooted at `package.json` with workspaces under `apps/*` and `packages/*`.
- Package manager is detected by lockfile (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`/npm).
