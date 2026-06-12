# Contradiction ledger

**Last updated:** 2026-06-12

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-06-12 logger-first pass)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-REG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | Workflow log channel was not wired to dedicated rotated output. | New `workflow.log` appender + target filter `medoc::workflow`. | P1 | Closed by commit `bc9c978`. |
| WF-REG-002 | `crates/app/medoc-practice/src/commands/system/logging.rs` | Missing sanitized FE→BE workflow event bridge command. | Added `log_workflow_event` command + sanitization tests. | P1 | Closed by commits `bc9c978`, `95197b4`. |
| WF-REG-003 | `apps/practice-host-ui/src/services/tauri.service.ts`, `apps/practice-host-ui/src/App.tsx`, `packages/ui/src/dialog.tsx` | Route/action lifecycle events were not centrally persisted. | Added route-enter tracker, IPC start/success/error hooks, dialog cancel hooks. | P1 | Closed by commit `bc9c978`. |
| WF-REG-004 | Workflow map + non-terminable flow detection | Step-2 state-machine sweep required by automation brief remains incomplete in this slice. | No generated full workflow state-machine register this run (**NOT RUN**). | P2 | Keep open; execute in next audit run. |
| WF-REG-005 | Geometry + a11y browser audit | Steps 4–5 (Playwright geometry snapshots + axe/contrast) remain incomplete in this slice. | No new Playwright/axe suites or snapshots this run (**NOT RUN**). | P2 | Keep open; execute in next audit run. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
