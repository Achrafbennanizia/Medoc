# MeDoc CI/CD pipeline plan (verify, safe autofix, gated release)

Last updated: 2026-06-25

## Workspace truth used for this pipeline

- Rust workspace root: `Cargo.toml` with members under `apps/*` and `crates/*`.
- JS workspace root: `package.json` with workspaces under `apps/*` and `packages/*`.
- Legacy workflow path assumptions were retired with this migration. The pipeline now targets the live root workspace layout.

## Tier model

| Tier | Workflow | Trigger | Repo mutation | Purpose |
| --- | --- | --- | --- | --- |
| 1 | `.github/workflows/verify.yml` | `push` (`main`), `pull_request`, `workflow_call` | **No** | Blocking verification (Rust, JS, audit, axe-core). |
| 2 | `.github/workflows/autofix.yml` | `pull_request` only | **PR head branch only** | Deterministic formatting/lint fixes (`cargo fmt`, `lint:fix`, `format`) with loop guard. |
| 3 | `.github/workflows/fix-proposal.yml` | Manual dispatch or failed `verify` on `main` | **New proposal branch only** | Draft PR proposal with failing-before / fix attempt / passing-after evidence. |
| 4 | `.github/workflows/release.yml` | Tag `v*` or manual dispatch | **No** | Re-run verify gate, protected manual approval, signed artifacts + provenance. |

## Guardrails enforced

1. Verify jobs do not run fix commands and do not commit.
2. Autofix is restricted to `pull_request`; never on `push main` or tag/release.
3. Loop guard in Tier 2:
   - job-level actor guard: `if: github.actor != 'github-actions[bot]'`
   - latest-commit author check to stop bot-on-bot loops.
4. Tier 2 allows deterministic, logic-free changes only:
   - `cargo fmt --all`
   - `lint:fix` / `format` scripts if available.
5. Tier 3 uses draft PRs only and never auto-merges.
6. Tier 3 security guardrail:
   - if changed paths match `security|audit|crypto|rbac`, add `needs-human-review`.
7. Concurrency cancellation and explicit timeouts are set in every workflow.
8. Tier 4 runs under protected environment `release` (manual approval gate), builds signed artifacts from the tagged commit, and generates provenance attestation.

## Verification scope (Tier 1)

- Rust:
  - `cargo fmt --all -- --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace`
  - `cargo audit`
- JS (package-manager auto-detected from lockfile):
  - lint (no `--fix`)
  - typecheck
  - test
  - build
- Accessibility:
  - build UI,
  - run axe-core against the built app preview,
  - fail only on **critical** WCAG 2.1 A/AA violations.

## Release control mapping (IEC 62304 / freigabeprozess)

- `release.yml` reuses `verify.yml` as an explicit gate job.
- `build` job requires `environment: release` for manual approval.
- Build uses signing keys from repository secrets (`TAURI_SIGNING_PRIVATE_KEY` + optional password secret).
- Source mutation is not part of release; artifact provenance is attested via `actions/attest-build-provenance@v2`.
