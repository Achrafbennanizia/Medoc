# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-09-26 — logger + dialog-cancel telemetry slices)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-LOG-001 | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs`, `crates/app/medoc-practice/src/commands/system/logging.rs` | Desktop logging had no dedicated workflow channel and no explicit frontend→backend workflow event bridge. | Code inspection in this run found only `app/security/system/device/migration/perf` channels and no `log_workflow_event` command before edits. | P1 | **Fixed in this slice:** add `workflow.log`, `log_workflow!`, and `log_workflow_event` IPC command. |
| WF-LOG-002 | `apps/practice-host-ui/src/services/tauri.service.ts`, `apps/practice-host-ui/src/views/components/workflow-route-observer.tsx` | Route telemetry can leak patient/task/order identifiers if raw paths are logged. | Dynamic routes include ids (`/patients/:id`, `/tickets/:id/edit`, `/purchase-orders/:id`) in `apps/practice-host-ui/src/App.tsx`. | P1 | **Fixed in this slice:** normalize/redact route segments before emitting workflow events. |
| WF-LOG-003 | `packages/ui/src/dialog.tsx`, `apps/practice-host-ui/src/services/tauri.service.ts` | Dialog dismiss paths (Escape/backdrop/close button) did not emit workflow `cancel` events, so cancel branches were invisible in workflow logs used for Step-2 state-machine detection. | Failing-before component test `packages/ui/src/dialog.workflow.test.tsx` showed **0** `log_workflow_event` calls when pressing Escape; route map evidence from `apps/practice-host-ui/src/App.tsx` confirmed dialogs are critical exit paths across pages. | P1 | **Fixed in this slice:** shared `Dialog` now logs `action=dialog.dismiss`, `outcome=cancel` with normalized route for Escape/backdrop/close button; regression tests added in `packages/ui/src/dialog.workflow.test.tsx`. |
| WF-VAL-001 | `crates/shared/medoc-sync/src/cluster/services/cluster_reset_service.rs` | `cargo test` was intermittently failing in `reset_token_sign_verify_roundtrip` due global env mutation under parallel tests. | Two consecutive full-suite failures in this run with `Invalid signature`; targeted rerun passed; parallel stability restored after serializing test. | P2 | **Fixed in this slice:** mark test `#[serial]` to isolate env-sensitive secret setup. |
| WF-MAP-001 | UI-wide workflow map (`apps/practice-host-ui` routes/pages/components) | Full Step-2 state-machine audit for all routes/actions (non-terminable-flow scan) remains incomplete in this bounded run. | No complete route-by-route state-machine artifact produced in this slice. | P2 | Next run: execute full workflow-map + detection pass and append findings here with P0–P3 triage. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

