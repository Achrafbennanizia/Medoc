# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-26  
**Scope:** GitHub Actions workflows under `.github/workflows/`  
**Stack:** Tauri 2 + Rust workspace (`crates/*`, `apps/*`) + JavaScript workspace (`apps/*`, `packages/*`)

## 1) Non-negotiable release rule

Release gates verify and sign. They do not mutate source.

- **Verify tier**: read-only checks only (`--check`, no `--fix`)
- **Autofix tier**: deterministic, logic-free fixes only, PR branches only
- **Fix proposal tier**: non-deterministic/substantive remediation attempts on a new branch + draft PR
- **Release tier**: re-run verify, build signed artifacts under protected environment approval

## 2) Active workflow map

| Tier | Workflow | Trigger | Mutates source? | Notes |
| --- | --- | --- | --- | --- |
| 1 | `verify.yml` | `push` on `main`, `pull_request`, `workflow_call` | No | Blocking gate for merges/releases |
| 2 | `autofix.yml` | `pull_request` | PR branch only | Loop-guarded deterministic fixes |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` (`workflow_run`) | New proposal branch only | Opens draft PR; labels sensitive touches |
| 4 | `release.yml` | tag `v*`, `workflow_dispatch` | No | Calls Tier 1 gate + signed cross-platform build in protected `release` env |

## 3) Workspace detection and migration notes

- The legacy `.github/workflows/ci.yml` was retired.
- Tier 1 now executes from repository root and targets live workspace members:
  - Rust: `cargo` workspace rooted at `/Cargo.toml`
  - JS: package manager auto-detected from lockfile (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`)
- No workflow assumes deprecated `app/src-tauri` or `app/` as the CI working root.

## 4) Guardrails implemented

1. **Verify jobs do not mutate source**
   - Rust uses `cargo fmt --check`
   - Lint runs without fix flags
2. **Autofix is PR-only with loop guard**
   - `on: pull_request`
   - `if: github.actor != 'github-actions[bot]'`
3. **Deterministic-only autofix**
   - `cargo fmt`
   - eslint `--fix`
   - optional `format` script if present
4. **No protected-branch mutation by autofix**
   - writes only to PR head branch
5. **Sensitive code gate in Tier 3**
   - touching `security|audit|crypto|rbac` paths adds `needs-human-review` label and stops
6. **Termination safeguards**
   - workflow/job timeouts present
   - workflow concurrency cancellation in verify/autofix/release
7. **Release reproducibility**
   - Tier 4 gates on Tier 1 verify
   - build runs on tagged commit, signs bundle, uploads artifacts
   - manual approval enforced by protected `release` environment

## 5) Accessibility gate policy

Tier 1 includes an `a11y` job that:

- builds the web UI,
- runs `axe-core` with WCAG 2.1 A/AA tags,
- fails only on **critical** violations.

This keeps accessibility verification blocking without introducing source mutations.

## 6) Compliance intent mapping

- **IEC 62304 §5.8 release control**: enforced via protected environment approval in Tier 4
- **Auditability**: Tier 3 writes rationale + before/after evidence into draft PR body and uploads logs as artifacts
- **Separation of concerns**: mutation (Tier 2/3) is separated from release verification/signing (Tier 4)
