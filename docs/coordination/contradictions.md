# Contradiction ledger

**Last updated:** 2026-08-26

## Findings register — quality run 2026-08-26

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| QR-001 | `apps/practice-host-ui/src/critical-flows.smoke.test.tsx`, `apps/practice-host-ui/src/g21-routing.smoke.test.tsx` | Smoke suites deadlocked when rendering full `App` with strict IPC mocks after workflow logger integration. | `vitest` worker pegged at 100% CPU with no test completion until process kill; stabilized after mocking workflow logger + background gate components and relaxing unknown-command fallback for those suites. | P1 | **Done** (test harness hardened, no production path change). |
| QR-002 | `apps/practice-host-ui/src/lib/document-print-html.ts`, `packages/shared/src/lib/document-print-html.ts` | Frontend build currently blocked by nullable values passed where `string \| number` is required. | `npm run build` → TS2322 at lines 353/355/357 in both app alias and shared path. | P1 | **Open** — implement null-safe formatting guards and re-run build. |
| QR-003 | `apps/practice-host-ui/src/lib/termin-availability.ts`, `termin-calendar-layout.ts`, `views/components/termin-week-day-grid.tsx` | Build blocker from unused symbol diagnostics in strict TS build. | `npm run build` → TS6133 on `resolveEffectiveArbeitszeitenForArzt`, `fallback`, `deriveTerminTimelineBounds`. | P2 | **Open** — remove dead imports/locals or use them intentionally. |
| QR-004 | Rust workspace SQLCipher toolchain | Rust gates are blocked by missing OpenSSL headers on cloud host. | `cargo clippy` / `cargo test` fail at `libsqlite3-sys` build: `fatal error: 'openssl/crypto.h' file not found`. | P1 | **Open** — provision OpenSSL development headers in environment image. |
| QR-005 | `apps/practice-host-ui/e2e-playwright/ui-spacing.spec.ts` execution path | Geometry/spacing Playwright audit cannot start while frontend build is red. | `MEDOC_UI_E2E=1 npx playwright test ...` fails: `webServer` command `tsc && vite build` exits 2. | P2 | **Open** — unblock build first, then execute spacing+snapshot suite. |

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
