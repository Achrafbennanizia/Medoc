# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow QA findings register (2026-09-26)

| ID | Location | Finding | Evidence | Severity (P0–P3) | Action |
| -- | -------- | ------- | -------- | ---------------- | ------ |
| F-LOG-001 | `crates/app/medoc-practice/src/commands/**` + `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | 67/314 Tauri commands lacked `#[tracing::instrument]`, and the JSON layer used `FmtSpan::NONE`; many command runs produced no structured lifecycle event. | Command: `python3` scanner on `#[tauri::command]` (00:13 UTC) reported `missing 67`; `logging/mod.rs` showed `.with_span_events(FmtSpan::NONE)`. | **P1** | Added `#[tracing::instrument(level = "info", skip_all)]` to missing commands and switched tracing JSON layer to `FmtSpan::CLOSE`. |
| F-LOG-002 | `apps/practice-host-ui/src/services/tauri.service.ts` + `apps/practice-host-ui/src/views/components/workflow-route-logger.tsx` + `crates/app/medoc-practice/src/commands/system/logging.rs` | No dedicated sanitized frontend→backend workflow bridge for route/action lifecycle logging (`route enter`, action start/result). | `rg "log_workflow_event"` under `apps/practice-host-ui/src` returned no matches before edit; logging subsystem had no `workflow.log` appender. | **P1** | Added `workflow.log` channel, new `log_workflow_event` command, frontend bridge in `tauriInvoke`, and route-enter logger component with unit tests. |
| F-VAL-003 | Validation prerequisites (`MEDOC_VENDOR_PUBKEY` + native deps) | Rust workspace checks require both native GTK/OpenSSL headers and a CI-compatible `MEDOC_VENDOR_PUBKEY` during build/test. | Initial failures: missing `gdk-3.0.pc` / `openssl/crypto.h`; after installing deps, tests still failed with mismatched dummy pubkey; final rerun with CI key passed full `cargo clippy` + `cargo test --workspace`. | **P2** | Document and reuse the working validation preconditions in `validation.md` and phase handoff; keep as an operational caveat for future runs. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

