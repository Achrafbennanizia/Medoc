# MeDoc CI/CD pipeline plan (verify-first, safe autofix, gated release)

**Last updated:** 2026-10-26

## 1) Workspace detection (source of truth)

- Rust workspace: repo-root `Cargo.toml` with members under `apps/*` and `crates/*`.
- JS workspace: repo-root `package.json` with workspaces under `apps/*`, `packages/*`, and `website`.
- Legacy `app/src-tauri`/`app/` paths are retired and are not used by the new CI tiers.

## 2) Four-tier pipeline

### Tier 1 — `verify.yml` (blocking, no mutation)

Trigger:
- `push`
- `pull_request`
- `workflow_call` (for release re-use)

Checks:
- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`
- JS: package-manager detection from lockfile (`pnpm`/`yarn`/`npm`), then lint (no fix), typecheck, test, build
- Accessibility: Playwright + axe, WCAG 2.1 A/AA tags, fail only on **critical** violations

Safety:
- Concurrency cancellation enabled
- Per-job timeout set
- No `--fix` flags in verify

### Tier 2 — `autofix.yml` (PR head only, deterministic)

Trigger:
- `pull_request` only

Fix scope:
- `cargo fmt --all`
- `lint:fix`
- `format`

Safety:
- Loop guard: skip when actor is `github-actions[bot]`
- Never runs on push to `main` or on release
- Commits only if there is a deterministic diff

### Tier 3 — `fix-proposal.yml` (new branch + draft PR)

Trigger:
- `workflow_dispatch`
- failed `verify` on `main` (`workflow_run`)

Behavior:
- Checks out failing ref
- Captures failing-before evidence (`cargo test`, `cargo audit`, JS `typecheck`)
- Attempts substantive remediation on a proposal branch (currently lockfile-focused: `cargo update -w`, npm `audit fix --package-lock-only`)
- Captures passing-after evidence
- Opens **draft** PR with diff + rationale + before/after check table

Safety:
- Never auto-merges
- If changed paths match `security|audit|crypto|rbac`, add `needs-human-review`

### Tier 4 — `release.yml` (gated, signed, no source mutation)

Trigger:
- `push` tags `v*`
- `workflow_dispatch`

Behavior:
- Re-runs full verify by calling `./.github/workflows/verify.yml`
- Builds signed bundles on Ubuntu, Windows, macOS
- Runs under protected `release` environment (manual approval gate)
- Uploads platform artifacts

Safety:
- Release job never mutates source
- Concurrency cancellation + timeout enforced
- Aligns with `docs/process/freigabeprozess.md` release control intent

## 3) Guardrails

1. Verify gates do not mutate repository content.
2. Autofix is PR-only, deterministic, and loop-guarded.
3. Substantive fixes are proposed as draft PRs; humans merge.
4. Security/audit/crypto/RBAC touching proposals are labeled `needs-human-review`.
5. Release runs verify + signed build on tagged commit; no write-back to source tree.
