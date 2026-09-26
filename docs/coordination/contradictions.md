# Contradiction ledger

**Last updated:** 2026-09-26

## Workflow audit findings register (2026-09-26)

| ID | Location | Finding | Evidence | Severity (P0–P3) | Action |
| -- | -------- | ------- | -------- | ---------------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` (pre-run state) | Workflow events did not have a dedicated log channel; route/action traces were not separable from generic app logs. | Pre-run file inspection showed only `app/security/system/device/migration/perf` channels and no `workflow` target. | P1 | **Resolved in this run** by adding `workflow.log` channel + `medoc::workflow` macro target and frontend bridge events. |
| WF-LOG-002 | `crates/shared/medoc-sync/src/cluster/services/cluster_reset_service.rs:525` | Full Rust test gate previously showed a flaky signature verification failure (`Validation("Invalid signature")`) in `reset_token_sign_verify_roundtrip`. | Prior run: one failure + immediate isolated rerun pass (`cargo test -p medoc-sync … --exact`). Current run: `cargo test --workspace --tests` passed end-to-end (flake not reproduced). | P1 | Keep tracked as intermittent quality risk; **no autonomous crypto-path edits** in this run per guardrails. |
| WF-LOG-003 | `apps/practice-host-ui/src/services/tauri.service.ts`, `packages/ui/src/dialog.tsx`, `apps/practice-host-ui/src/App.tsx` | Route/action/cancel telemetry is now wired, but live manual observation of rotation and redaction in a running GUI session is still missing. | This run validated via Rust/Vitest tests only; GUI workflow log inspection is **NOT OBSERVED**. | P2 | Next run: perform live workflow walkthrough and inspect on-disk `workflow.log` rotation + redaction behavior. |

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
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

