# MeDoc CI/CD pipeline plan (verify-first, safe auto-fix, gated release)

**Status:** active reference for `.github/workflows/{verify,autofix,fix-proposal,release}.yml`  
**Last updated:** 2026-09-26

## Objectives

1. Verify every change against the live workspace (`crates/*`, `apps/*`, `packages/*`).
2. Keep release artifacts reproducible (no source mutation in release path).
3. Allow only deterministic, logic-free auto-fixes and only on PR head branches.
4. Route substantive fixes through draft PR proposals for human review.

## Tier layout

| Tier | Workflow | Trigger | Mutates repo? | Notes |
| --- | --- | --- | :---: | --- |
| 1 | `verify.yml` | `push` (main), `pull_request`, `workflow_call` | No | Blocking checks: Rust + JS + a11y critical gate |
| 2 | `autofix.yml` | `pull_request` | PR head branch only | `cargo fmt`, JS `lint:fix` + `format`, loop guard |
| 3 | `fix-proposal.yml` | `workflow_dispatch`, failed `verify` on `main` (`workflow_run`) | New draft PR branch only | Substantive fixes proposed, never auto-merged |
| 4 | `release.yml` | tags `v*`, `workflow_dispatch` | No | Reuses verify gate, protected `release` environment, signed bundles |

## Guardrails

- **Verify does not mutate source.** No `--fix` in tier 1.
- **Auto-fix is PR-only.** Never runs on protected branch pushes.
- **Loop guard enabled.** `autofix` skips `github-actions[bot]`.
- **Deterministic fixes only in tier 2.** No logic-changing commands.
- **Compliance-sensitive paths protected.** Tier 2 aborts on path hits matching `security|audit|crypto|rbac`.
- **Tier 3 labels protected changes.** Draft proposal PRs touching sensitive paths receive `needs-human-review` and the run stops.
- **Terminable runs.** Concurrency cancellation + per-job timeouts.
- **Release reproducibility.** Tier 4 verifies tagged commit and signs artifacts without rewriting source.

## Package manager policy

- Detect package manager from lockfile at runtime:
  - `pnpm-lock.yaml` → `pnpm`
  - `yarn.lock` → `yarn`
  - fallback → `npm`
- Install with frozen/immutable lock semantics (`pnpm --frozen-lockfile`, `yarn --immutable`, `npm ci`).

## Accessibility gate

- `verify.yml` runs Playwright + `axe-core` against built UI via `scripts/ci-axe-critical.mjs`.
- Scan runs with `wcag2a,wcag2aa` rules and fails **only** when critical-impact violations exist.
- Report is emitted as JSON (`a11y-report.json`) for auditability.

## Release controls

- `release.yml` starts with `gate` job calling `verify.yml` on the tag.
- `build` job runs under protected `release` environment (manual approval boundary).
- Signed Tauri bundles are uploaded per platform and traceable to the tagged commit.

