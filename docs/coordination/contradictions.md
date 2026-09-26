# Contradiction ledger

**Last updated:** 2026-09-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow finding register (2026-09-26)

| ID | Location | Finding | Evidence | Severity (P0–P3) | Action |
| -- | -------- | ------- | -------- | ---------------- | ------ |
| WF-2026-09-26-01 | `crates/shared/medoc-sync/src/cluster/services/cluster_reset_service.rs` | `reset_token_sign_verify_roundtrip` is flaky: fails with `Invalid signature` in full-suite runs but passes on rerun. | `cargo test --workspace --tests` failed once (`Invalid signature`), then passed on immediate retry in same workspace run. | P2 | Stabilize signer/verifier path (seed/control randomness or shared state) and mark as serial if needed. |
| WF-2026-09-26-02 | `packages/shared/src/lib/http-practice.adapter.test.ts:29` | Unawaited `expect(...).rejects` warning can become a hard failure in future Vitest versions. | `npm run test` output warns: “Promise returned by expect(...).rejects.toThrow(...) was not awaited”. | P3 | Await the rejection assertion to remove forward-compat test risk. |
| WF-2026-09-26-03 | `apps/practice-host-ui/src/services/tauri.service.ts` + dialog/button handlers | `cancel` workflow events are inferred from error message text (`cancel`/`abort`), not explicit UI cancel hooks. | Code inspection of new bridge shows cancel classification is string-based in command-error path. | P3 | Add explicit `logWorkflowEvent(... step=\"cancel\")` calls on dialog dismiss / Escape / cancel buttons for critical flows. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

