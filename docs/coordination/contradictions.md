# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |
| C10 | Rust suite determinism (`cargo test`) | Run policy expects a green default full suite | `cargo test` currently fails in `medoc-sync` (`reset_token_sign_verify_roundtrip` invalid signature), but the same test passes when isolated and with `--test-threads=1` | **Open** — mark as concurrency/flakiness risk; investigate shared state in cluster reset token tests before relying on parallel full-suite runs. |

## Findings register (workflow instrumentation run — 2026-09-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | No dedicated workflow channel existed; UI workflow telemetry could not be isolated from app/system logs. | Pre-change channel list only had app/security/system/device/migration/perf; no `workflow.log` target in subscriber layers. | P1 | Added `workflow.log` channel + `log_workflow!` macro + dedicated `medoc::workflow` filter layer. |
| LOG-002 | `packages/app/practice-host/src/adapters/practice-transport.ts`, `.../controllers/logging.controller.ts`, `crates/app/medoc-practice/src/commands/system/logging.rs` | No sanitized frontend→backend workflow bridge for route/action lifecycle events. | No `log_workflow_event` IPC command or caller in controllers/adapters before this run. | P1 | Added `log_workflow_event` IPC (sanitized fields) and frontend emission for route-enter + invoke primary/success/error phases. |
| LOG-003 | `crates/shared/medoc-core/src/domain/services/workflow_transitions.rs` | Domain transition checks emitted no structured workflow log events. | Transition helpers returned validation results without any workflow-target event logging. | P2 | Added structured `DOMAIN_STATE_*` events (allowed/denied/noop) via `log_workflow!` in central transition service. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

