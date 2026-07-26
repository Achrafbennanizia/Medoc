# Contradiction ledger

**Last updated:** 2026-07-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Findings register (2026-07-26 workflow logging run)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs`, `packages/app/practice-host/src/lib/workflow-logger.ts` | Missing dedicated workflow log channel and sanitized FE→BE telemetry bridge | New `workflow.log` target + `log_workflow_event` command + route/invoke telemetry bridge added and covered by tests | P1 | **Implemented in this run** |
| WF-VAL-001 | `cargo fmt --all -- --check` | Workspace formatting gate is red before/after this run | rustfmt diff spans many unrelated files | P2 | Separate formatting cleanup wave required (do not couple to instrumentation PR) |
| WF-VAL-002 | `cargo clippy --workspace --all-targets -- -D warnings` | Workspace clippy gate is red before/after this run | Existing clippy errors in `commands/network/company_portal.rs` and `infrastructure/app_menu.rs` | P1 | Open follow-up PR focused on clippy debt only |
| WF-VAL-003 | `cargo test --workspace --tests` | Workspace Rust tests are red before/after this run | `auth_session_audit_tests` fails on `Maximal 1 Arzt-Konto erlaubt` constraint | P1 | Isolate quota/test-fixture mismatch in dedicated bugfix PR |
| WF-VAL-004 | `npm test` | Frontend suite remains red before/after this run | 3 failures in `g21-routing.smoke.test.tsx` due unmocked `onboarding_subscription_status` | P1 | Update smoke mocks in dedicated test-fix PR |
| WF-VAL-005 | `npm run build` | Frontend build remains red before/after this run | TS6133 unused symbol errors in existing `termin-*` files | P1 | Separate lint/type cleanup PR |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
