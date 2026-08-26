# Contradiction ledger

**Last updated:** 2026-06-16

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow and quality findings register (2026-08-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-2026-08-26-01 | `apps/practice-host-ui/e2e-playwright/spacing-audit.spec.ts` (`/login`) | Vite web run does not render the login layout; selectors (`.login-root__panels`, `.login-form`, `.login-submit`) are absent in all breakpoints, so geometry audit cannot evaluate intended UI workflow state. | `MEDOC_UI_E2E=1 npm run test:playwright -w medoc -- e2e-playwright/spacing-audit.spec.ts` (3 failed; selector-not-found assertions). Manual Playwright DOM probe showed heading `Willkommen bei MeDoc` with error text `Cannot read properties of undefined (reading 'invoke')`. | **P1** | Keep spacing audit as starter coverage; next pass should stub or bootstrap transport for browser-only runs so `/login` renders deterministically in Playwright. |
| WF-2026-08-26-02 | `packages/shared/src/lib/i18n-locales.test.ts` | Full frontend suite contains a non-deterministic timeout path: `fr and ar expose every de key with non-key values` exceeded default 5s during workspace run. | `timeout 240s npm run test` → test timeout failure at 6405ms; targeted rerun `npm run test -w medoc -- ../../packages/shared/src/lib/i18n-locales.test.ts --testTimeout=15000` passed. | **P2** | Stabilize timing budget for this test (or optimize implementation) before treating full-suite timeout as regression-free. |
| WF-2026-08-26-03 | `packages/shared/src/lib/http-practice.adapter.test.ts:29` | Pending Vitest deprecation risk: Promise rejection assertion is not awaited. | Repeated `npm run test` output warning: `Promise returned by expect(...).rejects.toThrow(...) was not awaited ... will fail in Vitest 3`. | **P3** | Update test to `await expect(...).rejects.toThrow(...)` to avoid future hard failure. |
| WF-2026-08-26-04 | `apps/practice-host-ui` + shared TS libs | Frontend production build is currently red on strict TypeScript checks unrelated to this logger patch. | `npm run build` failed on `document-print-html.ts` `TS2322` and several `TS6133` unused symbol errors (`termin-availability`, `termin-calendar-layout`, `termin-week-day-grid`). | **P1** | Fix type errors in dedicated follow-up PRs before claiming green full frontend gate. |
| WF-2026-08-26-05 | `crates/shared/medoc-core` / `apps/practice-host` test gates | Rust full-gate checks are not fully green in current baseline (clippy and full workspace tests). | `cargo +stable clippy --workspace --all-targets -- -D warnings` failed (`pdf_export.rs` `useless_format`, `cors_policy.rs` `result_large_err`); `cargo +stable test --workspace --tests` failed `auth_session_audit_tests`. | **P1** | Track as pre-existing baseline blockers; keep this run scoped to logger/test additions and quarantine/fix these in separate quality PRs. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
