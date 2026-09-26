# Contradiction ledger

**Last updated:** 2026-06-16

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

## Workflow findings register (2026-09-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | Dedicated `workflow.log` file channel did not exist; workflow telemetry had no isolated sink. | Code inspection before edit: only `app/security/system/device/migration/perf` channels. | P1 | **Resolved** in this run: added `medoc::workflow` layer + file appender. |
| WF-LOG-002 | `apps/practice-host-ui/src/services/tauri.service.ts` | Frontend→backend workflow transitions (`primary_action/success/error`) were not centrally emitted for every IPC invoke. | Pre-edit `tauriInvoke` only normalized args and called `invoke` with no event bridge. | P1 | **Resolved** in this run: central workflow event emission added (non-blocking). |
| WF-LOG-003 | UI-only cancellation/success paths | Coverage for pure client-side flows remains partial: route-enter + key dismiss flows are logged, but not every non-IPC UI transition has explicit success/cancel events yet. | Current instrumentation points: `AppLayout` route-enter + selected cancel dialogs; IPC path emits primary/success/error. | P2 | Extend component-level instrumentation in future runs (Step 2/3 workflow map expansion). |
| WF-MAP-001 | `apps/practice-host-ui/src/views/components/{session-gate,license-and-pairing-gate,cluster-onboarding-gate,db-setup-gate}.tsx` | Multiple startup/workflow gates had no timeout around async checks; a hung IPC call could trap users on non-terminating loading states. | Pre-fix code awaited `checkSession` / `syncGetStatus` / `clusterGetStatus` / `getDbSetupStatus` directly without timeout guard. | P1 | **Resolved** in this run: added `withTimeout(...)` guards (12–15s) and kept existing error/retry fallbacks. |
| WF-UI-001 | `apps/practice-host-ui/src/views/components/ui/toast-store.ts`, `apps/practice-host-ui/src/index.css` | Toast policy diverged from UI rules: error toasts dismissed at 6s and stack was top-right instead of bottom-right. | `DURATION.error = 6000`; `.toast-stack { top: ...; right: ... }` before fix. | P2 | **Resolved** in this run: error default 5s, bottom-right anchor, plus persistent mode for action-required toasts (`persistent: true`). |
| WF-GEO-001 | `apps/practice-host-ui/src/views/components/treatment-chart-composer-panel.tsx` | Off-scale arbitrary Tailwind class bypassed spacing tokens. | `npm run lint:tailwind-spacing -w medoc` flagged `min-h-[72px]`. | P2 | **Resolved** in this run: replaced with tokenized `min-h-20`; lint script added to block regressions. |
| WF-TEST-001 | `packages/shared/src/lib/http-practice.adapter.test.ts` | Test warning indicates a non-awaited `expect(...).rejects`, which will fail under stricter Vitest behavior. | `npm run test` stderr warning: “Promise returned by expect(...).rejects... was not awaited.” | P3 | **Open**: follow-up cleanup in separate test-hygiene slice. |

