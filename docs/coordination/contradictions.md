# Contradiction ledger

**Last updated:** 2026-06-16

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow quality register (2026-07-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WQ-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | No dedicated workflow log channel for frontend route/action lifecycle. | Added `workflow.log` appender + `medoc::workflow` filter + `log_workflow!` macro in commit `c64434c`. | P1 | **Fixed** (instrumentation commit). |
| WQ-LOG-002 | `apps/practice-host-ui/src/services/tauri.service.ts` + `crates/app/medoc-practice/src/commands/system/logging.rs` | No sanitized frontend→backend workflow bridge for route enter / primary action / success / error/cancel. | Added `recordWorkflowRouteEnter`, invoke lifecycle workflow events, and new `log_workflow_event` command (commit `c64434c`; tests `afe560a`). | P1 | **Fixed** (instrumentation + tests). |
| WQ-UI-001 | `packages/ui/src/toast-store.ts` | Error toast default duration was **6000ms**, violating 5s policy. | Failing test before fix: `../../packages/ui/src/toast-store.test.ts` expected 5000 but got 6000. | P2 | **Fixed** in commit `4d7aa62` (error duration 5000ms). |
| WQ-TEST-001 | `apps/practice-host-ui/src/*smoke.test.tsx` and `packages/shared/src/lib/billing-release-flow.test.ts` | Smoke mocks diverged after onboarding gate + route logger export; tests errored on missing mock exports/IPC. | `npm test` failed with missing `recordWorkflowRouteEnter` + `onboarding_subscription_status`; fixed by mock updates in commit `df0c621`. | P2 | **Fixed** (tests green). |
| WQ-BUILD-001 | `apps/practice-host-ui/src/lib/termin-availability.ts`, `termin-calendar-layout.ts`, `views/components/termin-week-day-grid.tsx` (+ mirrored package files) | Frontend production build fails due unused symbol diagnostics (`TS6133`). | `npm run build` fails with 5 TS6133 errors (latest run in `validation.md`). | P1 | **Open** — requires scoped cleanup in affected modules. |
| WQ-RUST-001 | workspace-wide | Rust fmt gate not green in current branch snapshot. | `cargo fmt --all -- --check` fails with many pre-existing diffs (`f26392ff-...txt`). | P2 | **Open** — baseline drift; not modified in this run. |
| WQ-RUST-002 | `crates/shared/medoc-core/tests/mvp_security_gates_tests.rs` | Clippy fails on constant assertions with newer toolchain. | `cargo clippy --workspace --all-targets -- -D warnings` errors on `assertions_on_constants`. | P2 | **Open** — test/lint hygiene follow-up. |
| WQ-RUST-003 | `apps/practice-host/tests/auth_session_audit_tests.rs` | Rust workspace tests fail at `authenticate_succeeds_for_arzt_without_totp_when_2fa_disabled` due seat-cap DB constraint. | `cargo test --workspace --tests` failure: `Maximal 1 Arzt-Konto erlaubt`. | P1 | **Open** — needs fixture/setup alignment. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
