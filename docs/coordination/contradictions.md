# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-09-26)

| ID | Location | Finding | Evidence | Severity (P0–P3) | Action |
| -- | -------- | ------- | -------- | ---------------- | ------ |
| WF-LOG-001 | `apps/practice-host-ui/src/services/tauri.service.ts`, `apps/practice-host-ui/src/views/components/workflow-route-logger.tsx` | Workflow bridge now emits route enter/leave and IPC lifecycle (`start/success/error`) to `log_workflow_event`; component-level explicit `cancel`/`primary` semantics are still not fully enumerated page-by-page. | Code inspection + new test `apps/practice-host-ui/src/services/tauri.service.test.ts` (5 PASS). | P2 | Extend page/component handlers with explicit `cancel` events in follow-up slices. |
| WF-LOG-002 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs` | Dedicated `workflow.log` channel and sanitized backend workflow command were missing before this run and are now implemented. | Commit `77102cc` adds `medoc::workflow` layer + `log_workflow_event`; tests in commit `584c858`. | P1 | Keep channel in retention/export flows and add end-to-end checks once Rust toolchain deps are unblocked. |
| WF-VAL-001 | Rust workspace validation environment | Required Rust checks are blocked by missing OpenSSL headers for SQLCipher (`openssl/crypto.h` not found), so full Rust validation cannot complete in this environment. | `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test --workspace` both fail at `libsqlite3-sys` build. | P1 | Install OpenSSL development headers (or provide CI image with SQLCipher prereqs) and re-run Rust validation gates. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

