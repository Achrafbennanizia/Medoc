# MeDoc CI/CD pipeline plan (verify + safe autofix + gated release)

**Last updated:** 2026-07-26  
**Scope:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`

## 1) Workspace reality (detected)

The pipeline is wired to the live mono-repo workspace, not retired `app/src-tauri` paths.

- **Rust workspace root:** `Cargo.toml` with members under `apps/*` and `crates/*`.
- **JavaScript workspace root:** `package.json` with workspaces under `apps/*` and `packages/*`.
- **Package manager:** auto-detected at runtime from lockfile (`pnpm-lock.yaml`, `yarn.lock`, fallback `package-lock.json`).

## 2) Tier model

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| Tier 1 | `verify.yml` | every push + PR + reusable call | **No** | Blocking quality/security/a11y gate |
| Tier 2 | `autofix.yml` | `pull_request` only | **Yes (PR head only)** | Deterministic formatting/lint fixes |
| Tier 3 | `fix-proposal.yml` | manual dispatch OR failed verify on `main` | **No direct main mutation** (draft PR only) | Non-deterministic repair attempt + evidence PR |
| Tier 4 | `release.yml` | tag `v*` or dispatch | **No** | Re-verify + signed multi-OS release build behind manual approval |

## 3) Guardrails implemented

1. **Verify never mutates source**
   - Tier 1 lint runs without `--fix`.
2. **Autofix is PR-branch-only**
   - Trigger is only `pull_request`.
   - Loop guard: `if: github.actor != 'github-actions[bot]'`.
3. **Deterministic-only autofix**
   - `cargo fmt`, lint fix path, optional format script.
4. **Sensitive-code handling in fix proposals**
   - Tier 3 detects touching `security|audit|crypto|rbac` paths and applies `needs-human-review` label.
5. **Terminable runs**
   - Concurrency cancel-in-progress enabled.
   - Per-job timeouts configured across all tiers.
6. **Release remains reproducible**
   - Tier 4 calls Tier 1 gate on tagged commit first.
   - Build runs in protected `release` environment and signs artifacts without editing source.

## 4) Tier details

### Tier 1 — `verify.yml`

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo audit`.
- Web: install via detected package manager, `lint`, TypeScript type-check, `test`, `build`.
- A11y: builds UI, serves built assets, runs `@axe-core/cli`, fails on **critical** WCAG 2.1 AA violations.

### Tier 2 — `autofix.yml`

- Runs only for same-repo PR branches.
- Applies deterministic fixes and pushes one commit to PR head when needed.
- Does not run on `push main`, tags, or release.

### Tier 3 — `fix-proposal.yml`

- Triggered manually or when Tier 1 fails on `main`.
- Creates a new branch, captures failing-before/passing-after gate evidence, attempts repair (`cargo fix`, dependency/audit repair paths), and opens a **draft PR**.
- Never auto-merges; sensitive-path proposals are labeled `needs-human-review`.

### Tier 4 — `release.yml`

- Trigger: `v*` tags or manual dispatch.
- Re-runs full verify gate first (`uses: ./.github/workflows/verify.yml`).
- Builds signed bundles on Ubuntu/Windows/macOS under protected `release` environment (manual approval gate).
- Uploads per-OS artifacts from `apps/practice-host/target/release/bundle/**/*`.

## 5) Required secrets (release)

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_PUBKEY`
- `MEDOC_UPDATER_GITHUB_PAT`

## 6) Operational note

`ci.yml` was retired and replaced by tiered workflows above to remove stale assumptions and make verify/autofix/release behavior explicit and auditable.
