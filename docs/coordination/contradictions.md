# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |
| C10 | Workflow telemetry scope | Run objective (all Tauri commands + service/domain transitions logged into dedicated workflow channel) | `log_workflow!` currently appears only in `commands/system/logging.rs` bridge command (`rg "medoc::workflow|log_workflow!" crates`) | **Open:** frontend bridge is in place, but backend domain transition coverage is partial. Next run should instrument high-risk service/domain transitions. |

## Workflow quality finding register (2026-09-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `apps/practice-host-ui/src/services/tauri.service.ts` | Dedicated workflow log channel + sanitized frontend bridge were missing. | Pre-change code had only app/security/system/device/migration/perf channels and no workflow event command wiring. | P1 | **Fixed** in commits `19996e6` (workflow channel, bridge command, route/cancel hooks) + `e0671b5` (bridge tests). |
| WF-TEST-002 | `packages/shared/src/lib/http-practice.adapter.test.ts` | Async rejection assertion was not awaited, producing Vitest v3 migration warning. | `npm run test` warned: “Promise returned by expect(...).rejects.toThrow(...) was not awaited.” | P3 | **Fixed** in commit `cb30031` by awaiting the rejection assertion. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

