# MeDoc CI/CD plan — verify, safe autofix, gated release

## Scope and design rule

The CI/CD pipeline verifies and gates merges/releases. The release artifact must match the reviewed/tagged commit exactly.

- Verify jobs are non-mutating.
- Autofix is deterministic and limited to PR head branches.
- Non-deterministic fixes are proposed through draft PRs.
- Release runs verify + signed build only, under manual environment approval.

## Workspace detection (live repo)

Detected from repository manifests:

- Rust workspace: `Cargo.toml` at repo root with members in `apps/practice-host` and `crates/**`.
- JavaScript workspace: root `package.json` workspaces include `apps/**` and `packages/**`.
- Package manager lockfile: `package-lock.json` currently present (workflows still detect pnpm/yarn/npm dynamically).

## Tier 1 — verify (`.github/workflows/verify.yml`)

Trigger:

- `push` to `main`
- `pull_request`
- `workflow_call` (for release gate reuse)

Behavior:

- Concurrency cancellation enabled (`verify-${ref}`).
- Per-job timeouts.
- Rust gate:
  - `cargo fmt --all --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- Web gate:
  - lockfile-based package manager detection
  - install with frozen lockfile mode
  - `lint`, `typecheck`, `test`, `build` in workspace `medoc`
- Accessibility gate:
  - build web UI
  - run axe-core against built UI (`apps/practice-host-ui/scripts/run-a11y-check.mjs`)
  - fail on critical WCAG 2.1 A/AA violations

## Tier 2 — autofix (`.github/workflows/autofix.yml`)

Trigger:

- `pull_request` only

Behavior and guardrails:

- Never runs on `push` to `main` or release triggers.
- Concurrency cancellation per PR head branch.
- Loop guard:
  - job-level actor check (`github-actions[bot]` skipped)
  - explicit last-commit-author check before applying fixes
- Deterministic-only actions:
  - `cargo fmt --all`
  - workspace `lint:fix`
  - workspace `format`
- Commits and pushes only if tree changed, back to PR head branch.

## Tier 3 — fix proposal (`.github/workflows/fix-proposal.yml`)

Trigger:

- `workflow_dispatch`
- `workflow_run` of `verify` when `main` fails

Behavior:

- Captures failing-before evidence (`cargo test`, `cargo audit`, web `typecheck`).
- Attempts a substantive branch-local fix pass (dependency update + script-driven remediation hooks).
- Captures passing-after evidence.
- Writes report under `docs/coordination/fix-proposals/`.
- Opens a **draft PR** on a new branch via `peter-evans/create-pull-request`.
- Never auto-merges.

Compliance guard:

- If diff touches security/audit/crypto/RBAC paths, adds `needs-human-review` label and stops the run.

## Tier 4 — release (`.github/workflows/release.yml`)

Trigger:

- tag push `v*`
- `workflow_dispatch`

Behavior:

- `gate` job reuses full `verify.yml` on the tagged commit.
- `build` job runs after gate across Linux/Windows/macOS.
- Uses protected `release` environment (manual approval point).
- Runs verify command (`cargo test --workspace`) and then signed Tauri build only.
- Uploads release bundle artifacts per OS.
- No source mutation in release path.

## Migration note

- Legacy `.github/workflows/ci.yml` was retired.
- New workflows are:
  - `verify.yml`
  - `autofix.yml`
  - `fix-proposal.yml`
  - `release.yml`
