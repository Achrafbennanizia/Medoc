# Contradiction ledger

**Last updated:** 2026-06-25

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-06-25 run)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | Dedicated workflow channel missing (workflow events mixed with generic channels) | Code inspection before patch + new `workflow.log` layer added in this run | P1 | **Fixed in this run** (new `medoc::workflow` target + rolling file channel) |
| WF-LOG-002 | `apps/practice-host-ui/src/services/tauri.service.ts`, `crates/app/medoc-practice/src/commands/system/logging.rs` | No sanitized frontend→backend workflow bridge for route/action/success/cancel/error events | Code inspection before patch (no `log_workflow_event` IPC; no workflow transport helper) | P1 | **Fixed in this run** (new `log_workflow_event` command + frontend bridge + tests) |
| WF-LOG-003 | `crates/app/medoc-practice/src/commands/register.rs` | Tauri command dispatches lacked centralized per-command breadcrumbs | Prior `register_invoke_handler` directly passed generated handler without wrapper logging | P2 | **Fixed in this run** (invoke wrapper logs `IPC_COMMAND_INVOKE` + `IPC_COMMAND_DISPATCHED`) |
| WF-ENV-001 | Rust workspace validation | Required Rust gates cannot execute in current toolchain environment | `cargo test/clippy` fail: Cargo 1.83 cannot parse crates requiring `edition2024` (`indexmap v2.14.0`, `wiremock v0.6.5`) | P1 | **Open** — upgrade Cargo/Rust toolchain or pin incompatible transitive dependencies |
| WF-FE-001 | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-detail-drawer.tsx` | Frontend build is already broken before/after logging changes | `npm run build` fails with TS2724/TS2554 in this file | P1 | **Open** — fix existing TS API mismatch before geometry/a11y audit phase |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note suggested connection-order semantics; prior code used `MasterWinsWithFreshness` (master wins timestamp ties) | **Product decision 2026-06-16:** pure **last-write-wins** by `updated_at`; equal timestamps broken by lexicographic `device_id` (no master tie-break). Push-then-pull transport order unchanged. | `merge.rs` + docs updated; Wave 2c E2E tests codify LWW | 2026-06-16 |
