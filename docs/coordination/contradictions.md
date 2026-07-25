# Contradiction ledger

**Last updated:** 2026-07-25

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-07-25 run)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-2026-07-25-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs`, `apps/practice-host-ui/src/services/tauri.service.ts` | Workflow lifecycle events were not routed to a dedicated sanitized channel. | Pre-run code had `app/security/system/device/migration/perf` channels only and no `log_workflow_event` command. | **P1** | **Resolved in this run**: added `workflow.log`, sanitized backend bridge, and frontend route/IPC lifecycle emission. |
| WF-2026-07-25-002 | `apps/practice-host/tests/auth_session_audit_tests.rs:31` | Workspace Rust tests fail in auth session audit due enforced Arzt seat cap during fixture setup. | `cargo +stable test --workspace --tests` failure: `Maximal 1 Arzt-Konto erlaubt (Admin-Platz belegt)`. | **P1** | Patch test fixture setup (or quota gate) so it does not violate MVP seat limits before auth assertions. |
| WF-2026-07-25-003 | `apps/practice-host-ui/src/critical-flows.smoke.test.tsx`, `apps/practice-host-ui/src/g21-routing.smoke.test.tsx` | Smoke flows fail because onboarding status IPC path is unmocked; flow lands on onboarding fallback instead of login. | `npm run test` reports 3 failing tests and message `unmocked IPC ... onboarding_subscription_status`. | **P2** | Update smoke test mocks to include onboarding status commands (or bypass onboarding gate in smoke harness). |
| WF-2026-07-25-004 | `apps/practice-host-ui/src/lib/termin-availability.ts`, `apps/practice-host-ui/src/lib/termin-calendar-layout.ts`, `apps/practice-host-ui/src/views/components/termin-week-day-grid.tsx` (+ mirrored package files) | TypeScript build currently blocked by unused symbol errors. | `npm run build` fails with TS6133 for `resolveEffectiveArbeitszeitenForArzt`, `fallback`, `deriveTerminTimelineBounds`. | **P2** | Remove unused bindings or rewire call sites, then rerun frontend build gate. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
