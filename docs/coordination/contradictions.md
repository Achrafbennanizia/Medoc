# Contradiction ledger

**Last updated:** 2026-10-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-10-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-2026-10-26-01 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | Workflow events were previously routed into `system.log`; no dedicated workflow channel existed. | Added `workflow.log` appender + filter (`target = medoc::workflow`) and removed workflow target from system filter. | P1 | **Done** in this run (logger extension commit). |
| WF-2026-10-26-02 | `apps/practice-host-ui/src/services/tauri.service.ts`, `crates/app/medoc-practice/src/commands/system/logging.rs` | Frontend workflow steps had no sanitized bridge to backend logging. | New `log_workflow_event` IPC + route/id sanitization helpers + invoke lifecycle emission tests (`tauri.service.test.ts`). | P1 | **Done** in this run (bridge + tests). |
| WF-2026-10-26-03 | Workflow-map / non-terminable flow audit scope | Full state-machine verification for all 55 routes and all UI actions remains incomplete in this bounded run. | `rg "<Route\\s+path=" apps/practice-host-ui/src/App.tsx` => 55 route entries; no full Playwright flow sweep executed this run. | P2 | **Open:** run Step-2/Step-4 broad workflow detection + geometry audit in follow-up run. |
| WF-2026-10-26-04 | Rust validation toolchain | Rust test/clippy execution is blocked by Cargo 1.83 parsing failure on `getrandom v0.4.2` (`edition2024`). | `cargo test --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` both fail before compile with `feature edition2024 is required`. | P1 | **Open:** upgrade toolchain to cargo supporting edition2024 before full Rust validation. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

