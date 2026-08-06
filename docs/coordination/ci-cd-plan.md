# MeDoc CI/CD pipeline plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-07-26  
**Workflows:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`

## 1) Design rule

Release gates verify artifacts; they do not mutate source.  
The shipped artifact must correspond exactly to the reviewed/tagged commit.

## 2) Live workspace detection (implemented)

The pipeline targets the current repository layout, not retired `app/src-tauri` assumptions:

- Rust workspace root: `Cargo.toml` with members under `apps/*` and `crates/*`
- JS workspace root: `package.json` with workspaces under `apps/*` and `packages/*`
- Package manager detection is lockfile-driven (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`)

## 3) Tier map

| Tier | Workflow | Trigger | Repo mutation |
| --- | --- | --- | --- |
| 1 | `verify.yml` | push to `main`, PR, reusable `workflow_call` | no |
| 2 | `autofix.yml` | `pull_request` | yes, PR head branch only |
| 3 | `fix-proposal.yml` | manual dispatch OR failed `verify` on `main` | yes, new draft-PR branch only |
| 4 | `release.yml` | tag `v*` or manual dispatch | no source mutation |

## 4) Tier details

### Tier 1 — `verify.yml` (blocking, zero mutation)

- Rust checks:
  - `cargo fmt --all -- --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- Web checks:
  - install via detected package manager
  - lint (non-fixing)
  - explicit type-check (`tsc --noEmit` for active UI apps)
  - tests
  - build
- Accessibility:
  - builds UI
  - serves built output
  - runs `axe-core` WCAG 2.1 A/AA scan
  - fails only when **critical** violations exist
- Guardrails:
  - concurrency cancellation (`cancel-in-progress: true`)
  - per-job timeouts
  - read-only permissions

### Tier 2 — `autofix.yml` (safe deterministic PR-branch fixes)

- Trigger: PR only
- Loop guard: `if: github.actor != 'github-actions[bot]'`
- Fork guard: runs only when PR head repo is this repository
- Allowed fix scope:
  - `cargo fmt --all`
  - lint autofix (`lint:fix` if present, else deterministic eslint fallback)
  - optional formatter script (`format`) when present
- Commits only when working tree changed, pushes back to PR head branch
- Never runs on `main` push or release tags

### Tier 3 — `fix-proposal.yml` (agent-driven draft fix PR)

- Trigger:
  - manual (`workflow_dispatch`)
  - automatic on failed `verify` run for `main`
- Behavior:
  - creates a **new** proposal branch (`ci/fix-proposal-<run-id>`)
  - runs configured fix-agent command (`agent_command` input or `CI_FIX_AGENT_COMMAND` secret)
  - collects failing-before and passing-after evidence
  - opens **draft** PR only (no auto-merge)
- Sensitive path gate:
  - if changed paths match `security|audit|crypto|rbac`, workflow adds label `needs-human-review` and stops with failure

### Tier 4 — `release.yml` (gated, reproducible release path)

- Runs on `v*` tags or manual dispatch
- Gate job re-runs full `verify.yml` on the tagged commit (`workflow_call`)
- Build job:
  - matrix: Linux, Windows, macOS
  - protected `release` environment (manual approval point)
  - signed Tauri build (`TAURI_SIGNING_PRIVATE_KEY*`, `TAURI_UPDATER_PUBKEY`)
  - uploads artifacts from `apps/practice-host/target/release/bundle/**`
- No source rewrites in release workflow

## 5) Guardrails encoded in workflows

1. Verify and release workflows do not run fixer commands.
2. Auto-fix runs on PR branches only and skips bot-authored commits.
3. Fix-proposal opens draft PRs; no merge automation.
4. Sensitive security/audit/crypto/RBAC proposals require human review label + stop.
5. Concurrency + timeouts are present to keep runs terminable.

## 6) Operational notes

- `fix-proposal.yml` requires a project-specific agent command to be configured:
  - workflow input `agent_command`, or
  - repository secret `CI_FIX_AGENT_COMMAND`
- For branch protections, required checks should reference Tier-1 verify jobs.

## 7) Paste-ready master command for coding agents

> Build the MeDoc CI/CD pipeline per `docs/coordination/ci-cd-plan.md`. The pipeline VERIFIES and gates; it must not silently rewrite code on protected or release paths. First detect the real workspace: the Rust cargo workspace under `crates/*` and `apps/*`, and the JS workspace under `apps/*` and `packages/*`. The existing `.github/workflows/ci.yml` targets retired assumptions; migrate to the live workspace and do not assume `app/src-tauri` paths.
>
> Create four tiers as separate workflows:
>
> **Tier 1 `verify.yml` (every push + PR, zero mutation, blocking):** `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`; detect the JS package manager from lockfile (pnpm/yarn/npm) and run lint (without `--fix`), typecheck, test, build; run axe-core against built UI and fail on critical WCAG 2.1 AA issues. Add concurrency cancellation and per-job timeouts.
>
> **Tier 2 `autofix.yml` (`pull_request` only):** deterministic formatting/lint fixes only (`cargo fmt`, lint autofix, optional format script), commit back to PR head, then let verify re-run. Add loop guard (`github.actor != 'github-actions[bot]'`). Never run this tier on `push` to main or release.
>
> **Tier 3 `fix-proposal.yml` (manual dispatch or red main):** run an agent on a new branch, attempt substantive fix, open draft PR with rationale + failing-before/passing-after evidence. Never auto-merge. If security/audit/crypto/RBAC paths are touched, add `needs-human-review` and stop.
>
> **Tier 4 `release.yml` (tag or dispatch):** re-run full verify on the tagged commit, then build signed cross-platform artifacts in protected `release` environment with manual approval. Release path verifies and signs only; no source mutation.
