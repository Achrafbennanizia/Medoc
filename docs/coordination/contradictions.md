# Contradiction ledger

**Last updated:** 2026-08-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-08-26 quality sweep)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-001 | `apps/practice-host-ui/e2e-playwright/ui-geometry-a11y.spec.ts`, `apps/practice-host-ui/src/views/components/verbund-onboarding-gate.tsx` | Web-preview Playwright run hit onboarding error instead of login (`Cannot read properties of undefined (reading 'invoke')`), making the login workflow probe non-terminable in browser-only mode. | `npm run test:playwright` failure (07:49 UTC) + `test-results/ui-geometry-a11y-login-spa-7ec1c--and-layout-snapshot-mobile-chromium/error-context.md` lines 29-33. | P2 | **Fixed in test harness:** add `page.addInitScript` Tauri invoke stub for startup commands in `ui-geometry-a11y.spec.ts`; rerun Playwright PASS. |
| WF-002 | Workspace quality gates (`cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`) | Requested “all gates green” conflicts with current baseline drift: widespread rustfmt deltas and strict clippy blockers in files outside this slice. | `cargo fmt --all -- --check` failed (2105 diff lines); `cargo clippy ... -D warnings` failed with `clippy::useless_format` in `crates/shared/medoc-core/src/application/akte/pdf_export.rs:616-617` and `clippy::result_large_err` in `crates/shared/medoc-core/src/infrastructure/cors_policy.rs:111`. | P1 | Keep as open blocker; do not auto-edit security-sensitive `cors_policy.rs` per run guardrails; escalate for maintainer review. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
