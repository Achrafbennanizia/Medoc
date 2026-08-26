# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

## Verified workspace targets

- **Rust workspace root:** `Cargo.toml` at repository root (`members` include `apps/practice-host`, `crates/*`).
- **JS workspace root:** `package.json` at repository root (`workspaces` include `apps/*`, `packages/*`).
- **Lockfile currently present:** `package-lock.json` (npm), while workflows still detect `pnpm`/`yarn` by lockfile.

## Pipeline rule

Release gates **verify only**. They never mutate source code.

## Tier map

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push`, `pull_request`, `workflow_call` | No | Blocking checks: Rust fmt/clippy/test/audit + JS lint/typecheck/test/build + axe-core a11y gate |
| 2 | `.github/workflows/autofix.yml` | `pull_request` only | PR branch only | Deterministic autofix only (`cargo fmt`, lint fix, optional format), commit back once |
| 3 | `.github/workflows/fix-proposal.yml` | manual dispatch or failed `verify` on `main` | New branch + draft PR | Agent-style substantive fix proposal with evidence; never auto-merge |
| 4 | `.github/workflows/release.yml` | tag `v*` or manual dispatch | No | Re-run full verify on tagged commit, then signed multi-OS artifacts in protected `release` environment |

## Guardrails implemented

1. **Verify never mutates** (`verify.yml` uses check-only commands).
2. **Autofix only on PR branches** (`on: pull_request`).
3. **Loop guard** in `autofix.yml`: skip bot actor (`github.actor != 'github-actions[bot]'`).
4. **Deterministic-only autofix**: formatting/linting; no logic-changing fix step.
5. **Sensitive-path escalation** in tier 3:
   - If changes touch `security`, `audit`, `crypto`, or `rbac` paths/patterns, the PR gets `needs-human-review`.
6. **Terminating runs**: all workflows set job timeouts and concurrency cancellation.
7. **Reproducible release**: `release.yml` calls `verify.yml` first, then builds signed artifacts from the same tagged commit under manual approval.

## Notes

- Tier 3 accepts a configurable fix command via:
  - workflow input `fix_agent_command`, or
  - repository variable `CI_FIX_AGENT_COMMAND`.
- If no fix command is configured or no diff is produced, tier 3 exits without opening a PR.
