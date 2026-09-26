# MeDoc CI/CD plan (verify, safe auto-fix, gated release)

**Last updated:** 2026-09-26

## Workspace detection (live paths)

- Rust workspace root: `Cargo.toml` at repo root with members under:
  - `apps/practice-host`
  - `crates/*`
  - `installer/medoc-usb-setup`
- JS workspace root: `package.json` at repo root with workspaces under:
  - `apps/*`
  - `packages/*`
  - `website`
- Package-manager lockfile detection is runtime-driven in workflows:
  - `pnpm-lock.yaml` → pnpm
  - `yarn.lock` → yarn
  - fallback → npm

## Tier map

| Tier | Workflow | Trigger | Mutates repo | Purpose |
| --- | --- | --- | :---: | --- |
| 1 | `.github/workflows/verify.yml` | push to `main`, PR, workflow call | No | Blocking verification (Rust + JS + a11y + audit) |
| 2 | `.github/workflows/autofix.yml` | PR only | PR branch only | Deterministic fixes (`cargo fmt`, lint/format safe attempts) |
| 3 | `.github/workflows/fix-proposal.yml` | manual dispatch; failed `verify` on `main` | New branch + draft PR only | Proposal fixes with evidence, never auto-merge |
| 4 | `.github/workflows/release.yml` | tag `v*` or manual dispatch | No | Verify gate + signed artifacts + manual approval |

`ci.yml` is now a compatibility wrapper that delegates to `verify.yml` on demand.

## Tier 1 — verify (blocking, zero mutation)

`verify.yml` runs three jobs with per-job timeouts and `cancel-in-progress` concurrency:

1. **Rust**
   - `cargo fmt --all --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
   - `cargo audit`
2. **Web**
   - package-manager detection from lockfile
   - install via detected package manager
   - lint (without `--fix`)
   - typecheck
   - test
   - build (`medoc` + `medoc-lan-web-client`)
3. **Accessibility**
   - build web UI
   - run `@axe-core/cli`
   - fail only on **critical** WCAG 2.1 AA violations

## Tier 2 — autofix (PR branches only)

`autofix.yml`:

- trigger: `pull_request` only
- loop guard: `if: github.actor != 'github-actions[bot]'`
- deterministic-only operations:
  - `cargo fmt --all`
  - `lint:fix` / eslint `--fix` safe fallback
  - `format` script if present
- commits only when diff exists
- pushes back to PR head branch
- blocks any attempted changes to files matching security/audit/crypto/RBAC path patterns

## Tier 3 — fix proposal (new branch + draft PR)

`fix-proposal.yml`:

- trigger:
  - manual dispatch with explicit commands, or
  - failed `verify` on `main`
- runs **before/fix/after** command sequence and captures evidence logs
- opens a **draft** PR on a new `ci/fix-proposal-*` branch
- embeds failing-before / passing-after evidence in PR body
- if security/audit/crypto/RBAC files are touched:
  - adds `needs-human-review` label
  - stops after opening draft PR (no auto-merge path)

For auto-triggered `main` failures, set repository variable `CI_FIX_PROPOSAL_COMMAND` to define the fix attempt command.

## Tier 4 — release (gated, signed, reproducible)

`release.yml`:

- trigger: `v*` tags or manual dispatch
- `gate` job reuses full `verify.yml` on the tagged commit
- `build` matrix: Linux + Windows + macOS
- protected environment: `release` (manual approval gate)
- no mutation of source tree; verification and signing only
- signed Tauri bundles uploaded as artifacts
- build provenance attestation generated (`actions/attest-build-provenance`)

## Guardrails implemented

1. Verify jobs do not run fix flags or commits.
2. Auto-fix is PR-only and bot-loop guarded.
3. Deterministic fixes only in tier 2.
4. Security/audit/crypto/RBAC scope gets human-review enforcement.
5. All jobs include timeouts and cancellation concurrency.
6. Release path is verify-gated, approval-gated, signed, and non-mutating.
