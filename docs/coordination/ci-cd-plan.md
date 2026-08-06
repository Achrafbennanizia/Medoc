# MeDoc CI/CD pipeline plan (verify-first, safe auto-fix, gated release)

**Last updated:** 2026-07-25  
**Workflows:** `.github/workflows/verify.yml`, `autofix.yml`, `fix-proposal.yml`, `release.yml`

## 1) Workspace detection (authoritative)

- **Rust workspace:** repo-root `Cargo.toml` with members under `apps/*` and `crates/*`.
- **JavaScript workspace:** repo-root `package.json` with workspaces under `apps/*` and `packages/*`.
- **Package manager detection:** each JS workflow detects `pnpm-lock.yaml`, then `yarn.lock`, otherwise defaults to `npm`.

## 2) Tier model

### Tier 1 — `verify.yml` (blocking, zero mutation)

**Trigger:** every push + pull request (`workflow_call` enabled for release reuse).  
**Mutation policy:** none (check-only).

Checks:

- Rust: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace --tests`, `cargo audit`.
- JS: install via detected package manager; `lint` (no `--fix`), `typecheck` (fallback to `check`), `test`, `build`.
- A11y: serve built UI from `apps/practice-host-ui/dist`, run `@axe-core/cli` with `wcag2a,wcag2aa`, fail only on `impact == critical`.

Runtime controls:

- Workflow-level concurrency cancelation (`verify-${ref}`).
- Per-job timeouts (Rust/JS: 30 min, a11y: 20 min).

### Tier 2 — `autofix.yml` (PR branch only, deterministic only)

**Trigger:** `pull_request` only.  
**Mutation policy:** only PR head branch, deterministic formatter/linter fixes.

Fixes:

- `cargo fmt --all`
- `lint:fix` (if available)
- `format` (if available)

Guardrails:

- Loop guard: job is skipped for `github-actions[bot]`.
- Same-repo guard: skips fork PRs without write access.
- Commit/push only when the tree changed.
- No push trigger on protected/release branches because workflow is PR-only.

### Tier 3 — `fix-proposal.yml` (draft proposal path)

**Trigger:** manual dispatch or failed `verify` run on `main`.  
**Mutation policy:** never mutates protected branch; proposals only.

Flow:

1. Captures failing-before evidence (`verify_command` + triggering run URL).
2. Attempts a substantive fix via one of:
   - dispatch input `agent_command`, or
   - executable hook `scripts/ci/fix-proposal.sh`.
3. Captures passing-after evidence with the same verify command.
4. Opens a **draft PR** on a new branch `ci/fix-proposal/<run-id>` with rationale and evidence.

Sensitive-path guard:

- If diff touches security/audit/crypto/RBAC paths, apply label `needs-human-review` and stop the automation run.

### Tier 4 — `release.yml` (gated, signed, reproducible)

**Trigger:** `v*` tags or manual dispatch.  
**Mutation policy:** verify + build only (no source edits).

Flow:

1. Reuse full Tier 1 gate via `uses: ./.github/workflows/verify.yml`.
2. Build signed bundles on Linux/macOS/Windows in protected `release` environment (manual approval gate).
3. Upload artifacts from `apps/practice-host/target/release/bundle/**/*`.
4. Emit build provenance attestation.

## 3) Non-negotiable guardrails

1. Verify jobs must never rewrite repository state.
2. Auto-fix is deterministic-only and PR-branch-only.
3. Protected/release paths are never auto-mutated by tier 2.
4. Tier 3 proposals are always draft PRs and never auto-merged.
5. Security/audit/crypto/RBAC-touching proposals are explicitly labeled for human review.
6. Concurrency + timeouts are required in every tier to avoid non-terminating runs.
7. Release artifacts are produced from the verified tagged commit and signed with updater keys.
