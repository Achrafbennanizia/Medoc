# Contradiction ledger

**Last updated:** 2026-09-29

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-09-29)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs`, `apps/practice-host-ui/src/services/{workflow-bridge.ts,tauri.service.ts}`, `apps/practice-host-ui/src/App.tsx` | Dedicated workflow channel and UI→backend workflow bridge were missing, so route/action lifecycle signals were not persisted as structured workflow events. | Code inspection during this run found only `app/security/system/device/migration/perf` channels and no `log_workflow_event` IPC command; now added and routed through sanitizer. | P1 | **Resolved in code**: added `workflow.log`, sanitized `log_workflow_event`, route-enter emission, and IPC primary_action/success/error emission. |
| WF-LOG-002 | `crates/shared/medoc-core/src/domain/services/workflow_transitions.rs` | Domain workflow transition checks did not emit explicit transition-allowed/blocked events. | Prior transition helpers returned `Result` without emitting workflow-targeted trace records; now transition helpers emit `DOMAIN_STATE_TRANSITION` events to `medoc::workflow`. | P1 | **Resolved in code**: centralized transition logging added for appointment/chart/ticket/task/purchase-order state machines. |
| WF-VAL-001 | Validation environment (`cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`) | Required Rust workspace validation cannot complete in this Cloud VM due disk pressure while compiling heavy Rust/Tauri dependency graph (space exhaustion during build artifacts). | Command outputs in `validation.md` show repeated `No space left on device (os error 28)` failures during Rust compilation. | P2 | **Open**: rerun Rust checks on a roomier environment (or after aggressive cache policy) to close the gate. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

