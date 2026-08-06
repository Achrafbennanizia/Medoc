# Contradiction ledger

**Last updated:** 2026-07-25

## Workflow quality finding register (2026-07-25)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| Q-2026-07-25-01 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs` | Dedicated workflow log channel and sanitized frontend→backend workflow event bridge were missing. | Commit `6a87fc6`: adds `workflow.log` channel, `log_workflow!` target, and `log_workflow_event` IPC command with sanitizer. | P1 | **Resolved in code**; keep validating with smoke/UI workflow tests. |
| Q-2026-07-25-02 | `apps/practice-host-ui/src/services/tauri.service.ts`, `apps/practice-host-ui/src/views/layouts/app-layout.tsx` | UI workflow lifecycle events (route enter/action/success/cancel/error) were not emitted to backend logs. | Commit `6a87fc6`: adds invoke lifecycle bridge + route enter/Escape cancel logging; commit `8abf401` guards Vitest harness. | P1 | **Resolved in code**; keep extending coverage to additional UI cancel paths. |
| Q-2026-07-25-03 | Rust validation toolchain/build environment | `cargo clippy`/`cargo test` fail in this runner because SQLCipher C build cannot find `openssl/crypto.h`. | `cargo +stable clippy --locked --workspace --all-targets -- -D warnings` and `cargo +stable test --locked --workspace --tests` both fail with `libsqlite3-sys` build error at `sqlcipher/sqlite3.c:110594`. | P1 | Human/infra follow-up: provide OpenSSL headers in runner image (or SQLCipher-compatible build deps), then rerun full Rust gates. |
| Q-2026-07-25-04 | Frontend smoke tests | Baseline smoke tests fail on onboarding gate due `onboarding_subscription_status` being unmocked in critical/G21 smoke specs. | `npm run test` → 3 failing tests: `critical-flows.smoke.test.tsx` (flows a, f) and `g21-routing.smoke.test.tsx`; output shows `unmocked IPC ... onboarding_subscription_status`. | P2 | Update smoke fixtures/mocks for onboarding gate; rerun full `npm run test`. |
| Q-2026-07-25-05 | Frontend TypeScript build | Workspace build fails on pre-existing TS6133 unused symbol errors in termin utility modules. | `npm run build` fails in `termin-availability.ts`, `termin-calendar-layout.ts`, `termin-week-day-grid.tsx` (+ package mirrors). | P2 | Clean up unused symbols or relax strict-unused policy where intentional, then rerun `npm run build`. |

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
