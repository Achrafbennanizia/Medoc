# Contradiction ledger

**Last updated:** 2026-06-25

## Quality findings register (2026-06-25)

| ID | Location | Finding | Evidence | Severity | Action | Status |
| -- | -------- | ------- | -------- | -------- | ------ | ------ |
| QL-2026-06-25-001 | `packages/ui/src/dialog-workflow.smoke.test.tsx`, `apps/practice-host-ui/vite.config.ts` | Dialog smoke test executed under node project and used locale-fragile label assertion. | `npm test -- dialog-workflow.smoke.test.tsx` showed `document is not defined` under `\|node\|` and `/close/i` mismatch against `aria-label=\"Dialog schließen\"`. | P1 | Added explicit jsdom annotation for test file, tightened node-project smoke excludes, and updated assertion to locale-safe matcher + cleanup isolation. | **Fixed** (`321df98`, `7c9b9a5`) |
| QL-2026-06-25-002 | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-detail-drawer.tsx` | Frontend build failed due API drift against `aufgabe-workflow-ui.ts` exports/signatures. | `npm run build` failed with `TS2724` (`aufgabeWorkflowStepLabel` missing) and `TS2554` (too many args). | P1 | Aligned drawer imports/calls with current API (`aufgabeStatusLabel(status)`, `aufgabeTypLabel(typ)`, direct `step.label`). | **Fixed** (`40d90af`) |
| QL-2026-06-25-003 | Rust workspace toolchain environment (`libsqlite3-sys`) | Rust validation blocked because SQLCipher build cannot find OpenSSL headers. | `cargo +stable clippy` and `cargo +stable test` fail at `sqlcipher/sqlite3.c:110594:10: fatal error: 'openssl/crypto.h' file not found`. | P1 | Provision OpenSSL development headers (`libssl-dev`) or equivalent include path in CI/runner image; rerun Rust validation gates. | **Open** |
| QL-2026-06-25-004 | Rust workspace formatting state | `cargo fmt --check` fails due widespread formatting drift in Rust files. | `cargo fmt --all -- --check` reports diffs across multiple crates/files. | P2 | Run `cargo fmt --all`, review non-functional formatting-only diff, commit separately. | **Open** |
| QL-2026-06-25-005 | `packages/shared/src/lib/http-practice.adapter.test.ts` | Vitest warning: un-awaited rejection assertion may fail on future Vitest versions. | `npm test` logs: `Promise returned by expect(...).rejects.toThrow(...) was not awaited`. | P3 | Update test to `await expect(...).rejects.toThrow(...)` to future-proof suite. | **Open** |

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
| C8 | Replica merge conflict policy | Product note suggested connection-order semantics; prior code used `MasterWinsWithFreshness` (master wins timestamp ties) | **Product decision 2026-06-16:** pure **last-write-wins** by `updated_at`; equal timestamps broken by lexicographic `device_id` (no master tie-break). Push-then-pull transport order unchanged. | `merge.rs` + docs updated; Wave 2c E2E tests codify LWW | 2026-06-16 |
