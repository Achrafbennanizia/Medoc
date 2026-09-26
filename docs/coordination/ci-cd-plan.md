# MeDoc CI/CD plan (verify-first, safe autofix, gated release)

## Goal

The pipeline verifies and gates merges/releases. It does not silently rewrite protected paths.
Only deterministic formatting/lint autofixes are allowed on PR head branches.

## Tier mapping

| Tier | Workflow | Trigger | Mutates repo? | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | push + pull_request + workflow_call | No | Blocking checks across Rust + JS + a11y |
| 2 | `.github/workflows/autofix.yml` | pull_request | PR head only | Deterministic autofixes (`cargo fmt`, lint/format fix scripts) |
| 3 | `.github/workflows/fix-proposal.yml` | workflow_dispatch or failed `verify` on main push | New branch + draft PR | Substantive fix proposal with before/after evidence |
| 4 | `.github/workflows/release.yml` | `v*` tag or manual dispatch | No | Re-run verify, then signed release bundles behind manual `release` environment |

## Workspace detection rules

- Rust workspace root: `Cargo.toml` with members under `apps/*`, `crates/*`, `installer/*`.
- JS workspace root: `package.json` with workspaces under `apps/*`, `packages/*`, `website`.
- Package manager is detected from lockfiles in each workflow (`pnpm-lock.yaml` / `yarn.lock` / fallback `package-lock.json`).

## Global guardrails

1. Verify jobs never run fix flags.
2. Autofix runs only on `pull_request`.
3. Autofix loop guard: skip when actor is `github-actions[bot]`.
4. Autofix scope is deterministic and logic-free.
5. Sensitive changes (security/crypto/audit/RBAC/auth/permission paths) in Tier 3 are labeled `needs-human-review`.
6. Concurrency cancellation + per-job timeouts are enabled so runs terminate.
7. Release artifacts are built from an already-verified tagged commit and signed via Tauri signing secrets.

## Accessibility gate

Tier 1 runs an axe-core check against the built UI (`apps/practice-host-ui/dist`) via:

- `apps/practice-host-ui` script `test:a11y`
- runner script `scripts/ci-a11y-critical.mjs`

It fails only when **critical** WCAG 2.1 AA violations are detected.

## Legacy workflow compatibility

`.github/workflows/ci.yml` is retained as a manual/reusable entrypoint and forwards to `verify.yml`.
The primary blocking gate is `verify.yml`.
