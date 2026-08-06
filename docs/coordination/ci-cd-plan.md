# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

**Status:** implemented in `.github/workflows/` on `cursor/medoc-ci-cd-pipeline-815d`  
**Scope:** Tauri 2 + Rust workspace (`crates/*`, `apps/*`) + JS workspace (`apps/*`, `packages/*`)

## Workspace detection (source of truth)

- **Rust workspace root:** `Cargo.toml` at repository root with members in `apps/` and `crates/`.
- **JS workspace root:** `package.json` at repository root with workspaces in `apps/*` and `packages/*`.
- **Stale path migration:** old `.github/workflows/ci.yml` removed; checks moved to tiered workflows targeting the live workspace.

## Tiered workflows

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push`, `pull_request`, `workflow_call` | no | Blocking verification (Rust + web + accessibility) |
| 2 | `autofix.yml` | `pull_request` | yes (PR head only) | Deterministic `cargo fmt` + lint/format autofix, commit back to PR |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` (`workflow_run`) | yes (new branch only) | Draft fix proposal PR with before/after evidence |
| 4 | `release.yml` | `push` tags `v*`, `workflow_dispatch` | no | Re-run full verify, then signed cross-platform build in protected `release` environment |

## Guardrails enforced

1. **Verify path is read-only**  
   `verify.yml` uses non-fixing commands only (`cargo fmt --check`, `clippy -D warnings`, tests, audits, web lint/typecheck/test/build, axe critical check).

2. **Auto-fix limited to PR branches**  
   `autofix.yml` is `pull_request`-only with loop guard: `github.actor != 'github-actions[bot]'`.

3. **Deterministic fixes only in tier 2**  
   Tier 2 runs formatter/lint fixes only and pushes to `github.head_ref`.

4. **Tier 3 always proposes via draft PR**  
   `fix-proposal.yml` creates a new branch, captures failing-before/passing-after logs, opens **draft** PR, and never auto-merges.

5. **Sensitive-code guard for tier 3**  
   If changed paths match `security|audit|crypto|rbac`, tier 3 applies `needs-human-review` label and exits non-zero after PR creation.

6. **Termination controls**  
   Concurrency cancellation + explicit job timeouts on all workflow jobs.

7. **Release reproducibility + approval gate**  
   `release.yml` calls `verify.yml` on the tag commit, then builds signed artifacts only inside protected `environment: release` (manual approval point), and uploads signed outputs without mutating source.

## Accessibility gate details

- `verify.yml` `a11y` job:
  - builds web UI,
  - serves build with `vite preview`,
  - runs `axe-core` against `/` and `/login`,
  - fails only on **critical** WCAG 2.1 A/AA violations.
- Helper script: `.github/scripts/axe-critical-check.mjs`.

## Notes

- Package-manager detection is lockfile-based (`pnpm`, `yarn`, `npm`), with installation commands chosen accordingly.
- `release.yml` includes artifact provenance attestation via `actions/attest-build-provenance@v2`.
