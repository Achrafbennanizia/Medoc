# MeDoc CI/CD plan — verify-first pipeline with gated mutation

**Scope:** GitHub Actions for the live workspace (`apps/*`, `crates/*`, `packages/*`)  
**Status:** Implemented workflow migration (2026-07-26)

## 1) Core invariant

Release and merge gates verify artifacts from reviewed commits.  
Verification jobs do not rewrite source. Any automated mutation is limited to deterministic formatting on pull-request head branches only.

## 2) Workspace baseline (live paths)

- Rust workspace root: `Cargo.toml` with members under `apps/*` and `crates/*`.
- JavaScript workspace root: `package.json` workspaces (`apps/*`, `packages/*`).
- Legacy `app/src-tauri` and `app/` CI paths are retired for active pipelines.

## 3) Tier map

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request` | No | Blocking quality/security verification |
| 2 | `.github/workflows/autofix.yml` | `pull_request` | PR head branch only | Deterministic formatting and lint autofix |
| 3 | `.github/workflows/fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` | No direct merge; opens draft PR | Agent-assisted fix proposal with evidence |
| 4 | `.github/workflows/release.yml` | Tag `v*`, `workflow_dispatch` | No | Re-verify + signed, approved release artifacts |

## 4) Tier 1 — verify (blocking, zero mutation)

`verify.yml` provides three jobs with `concurrency.cancel-in-progress` and per-job timeouts:

1. **Rust**: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
2. **Web**: package-manager auto-detection from lockfile (`pnpm` / `yarn` / `npm`), then `lint` (no `--fix`), `typecheck`, `test`, `build`.
3. **A11y**: Playwright + axe-core critical WCAG 2.1 A/AA scan (`npm run test:a11y`) against built UI.

## 5) Tier 2 — autofix (PR branches only)

`autofix.yml` runs only on `pull_request` and only for same-repo PR heads.

- Loop guard: skips when actor is `github-actions[bot]`.
- Deterministic fixes only:
  - `cargo fmt --all`
  - JS `lint:fix`
  - JS `format`
- Commits back only when `git status --porcelain` is non-empty, then pushes to the PR head branch.

No logic-changing or non-deterministic repair is performed in tier 2.

## 6) Tier 3 — fix proposal (draft PR, human-reviewed)

`fix-proposal.yml` is a gated proposal workflow:

- Triggered manually or when `verify` fails on `main`.
- Replays failing signals (`typecheck`, `cargo test --workspace`) for before/after evidence.
- Runs an agentic fix attempt (`openai/codex-action`) on a new branch context.
- Opens a **draft PR** with:
  - rationale
  - failing-before / passing-after evidence
  - no auto-merge behavior
- If changed files match security-sensitive areas (`security`, `audit`, `crypto`, `rbac`), PR is labeled `needs-human-review`.

## 7) Tier 4 — release (manual gate + signed artifacts)

`release.yml` enforces a non-mutating release path:

1. **Gate job:** reuses `verify.yml` on the tagged commit.
2. **Build job (matrix):** `ubuntu-latest`, `windows-latest`, `macos-latest`.
3. **Protected environment:** `release` (manual approval checkpoint).
4. **Build/sign only:** runs tests and `tauri build` with signing key secrets.
5. **Provenance:** uploads artifacts and emits artifact provenance attestations.

No auto-fix or source rewriting runs in release jobs.

## 8) Guardrails

- Verify jobs never mutate source.
- Auto-fix is PR-only and bot-loop guarded.
- Tier 2 is deterministic formatting/lint fix only.
- Security/audit/crypto/RBAC touching proposals are forced to human review.
- All jobs use explicit timeouts and concurrency cancellation.
- Release artifacts are produced from approved, verified commits.
