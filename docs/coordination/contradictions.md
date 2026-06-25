# Contradiction ledger

**Last updated:** 2026-06-25

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |
| C9 | Required green gates vs current repository baseline | Run instruction requires `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace --tests`, `npm run lint` green | Current baseline still red on pre-existing Rust/FE issues (`auth_session_audit_tests`, clippy bool/assertion lints, FE hook/memoization lint errors) | Blocks claiming full green quality gate despite logger/test improvements. | Keep as explicit pre-existing blockers; do not mask with unrelated edits. |
| C10 | "Enumerate every route/action workflow" vs bounded audit evidence | Requested full workflow state-machine coverage | This run validated critical/smoke + login geometry/a11y only; many routes remain **NOT OBSERVED** in browser workflow execution | Completeness gap for full workflow-terminability claim. | Track as pending broad workflow sweep; current register reflects validated subset only. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note suggested connection-order semantics; prior code used `MasterWinsWithFreshness` (master wins timestamp ties) | **Product decision 2026-06-16:** pure **last-write-wins** by `updated_at`; equal timestamps broken by lexicographic `device_id` (no master tie-break). Push-then-pull transport order unchanged. | `merge.rs` + docs updated; Wave 2c E2E tests codify LWW | 2026-06-16 |
