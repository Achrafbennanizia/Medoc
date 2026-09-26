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

## Findings register — automation quality run (2026-09-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| Q-2026-09-26-01 | `apps/practice-host/tests/invoke_registration_tests.rs` | Invoke command count guard was stale after adding `log_workflow_step`; test gate failed. | `/home/ubuntu/.cursor/projects/workspace/agent-tools/94c52d69-a329-4f3d-b40c-180180ae71e7.txt` lines 755-772 (`left: 314 right: 313`). | P2 | Updated expected count to `314` and kept `EXPECTED_INVOKE_COMMAND_COUNT` aligned. |
| Q-2026-09-26-02 | `crates/shared/medoc-sync` unit tests | Flaky signature verification in workspace runs from env-var race on `MEDOC_PAIRING_MASTER_SECRET` / `MEDOC_CLUSTER_DEVICE_SECRET`. | `/home/ubuntu/.cursor/projects/workspace/agent-tools/cec6a8d0-924f-4736-bfa4-47687c509601.txt` lines 852, 889-899 and `d2981a3f-d126-486d-94e7-d087dd9e260c.txt` lines 849, 886-896 (`Validation("Invalid signature")`). | P1 | Added serial execution + env restore guards in env-mutating tests (`pairing/tests.rs`, `cluster_reset_service.rs`, `device_identity.rs`). |
| Q-2026-09-26-03 | `apps/practice-host-ui/e2e-playwright/geometry-spacing.spec.ts` | Geometry audit exists but is gated; default run does not execute spacing assertions. | `npm run test:playwright -w medoc -- e2e-playwright/geometry-spacing.spec.ts` output: `3 skipped` (2026-09-26). | P3 | Keep opt-in gate; schedule dedicated run with `MEDOC_UI_GEOMETRY=1` in browser-capable pipeline. |
| Q-2026-09-26-04 | `packages/shared/src/lib/http-practice.adapter.test.ts` | Vitest warning indicates one `rejects.toThrow` assertion is not awaited and may fail under Vitest 3 behavior. | `npm run test` output contains: `Promise returned by expect(...).rejects.toThrow(...) was not awaited` (2026-09-26). | P3 | Follow-up: update test assertion to explicit `await` before upgrading test runner behavior. |

