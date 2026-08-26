# Contradiction ledger

**Last updated:** 2026-06-16

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Findings register (2026-08-26 quality run)

| ID | Location | Finding | Evidence | Severity | Action | Status |
| -- | -------- | ------- | -------- | -------- | ------ | ------ |
| QF-2026-08-26-01 | `apps/practice-host-ui/src/index.css` + `apps/practice-host-ui/e2e-playwright/ui-geometry.spec.ts` | Toast stack was top-right (`top: max(12px, ...)`) while UI rule requires bottom-right anchoring. | `npx playwright test e2e-playwright/ui-geometry.spec.ts` failed with `toast-stack.bottom` / `toast-stack.top` mismatch and snapshot diffs. | P1 | Moved `.toast-stack` anchor to `bottom: max(12px, env(safe-area-inset-bottom, 0px))`; updated geometry assertion logic and refreshed snapshots. | **Resolved** |
| QF-2026-08-26-02 | `apps/practice-host-ui/package.json` test pipeline | Monolithic `vitest run` exhausted heap (`Allocation failed - JavaScript heap out of memory`), blocking `npm test`. | `npm test` repeatedly failed with OOM stacks (`ERR_IPC_CHANNEL_CLOSED`) before suite completion. | P1 | Split tests into `test:node`, `test:smoke`, `test:mvp-unit` and pinned smoke execution to explicit files. | **Resolved** |
| QF-2026-08-26-03 | Rust tests under role-cap constraints (`sync_outbox_hooks_tests`, `auth_session_audit_tests`) | Tests created extra ARZT rows that now violate MVP quota constraints, cascading into FK failures. | `cargo test --workspace --tests` failures: `FOREIGN KEY constraint failed` in outbox tests; quota failure in auth test. | P1 | Updated tests to reuse seeded staff IDs (`seed-arzt-001`, `seed-rez-001`) and seeded credentials. | **Resolved** |
| QF-2026-08-26-04 | Rust tests expecting old error variants/messages | Assertions expected legacy `AppError::Validation` or German text, but code now emits `ValidationCode` / updated strings. | Failures in `domain_services_tests`, `praxis_aufgabe_tests`, `license_v2_tests`, `pairing/tests.rs`, `engine_http_tests.rs`. | P2 | Relaxed assertions to accept `ValidationCode` and updated message checks to current contract. | **Resolved** |
| QF-2026-08-26-05 | `crates/shared/medoc-core/src/infrastructure/cors_policy.rs` | Clippy gate still fails on `clippy::result_large_err` in CORS middleware signature. | `cargo clippy --workspace --all-targets -- -D warnings` reports `Result<Response, Response>` large Err at line 111. | P1 | **No autonomous edit applied** (security-surface file under exclusion rule). Escalate for human review / explicit approval. | **Open** |
| QF-2026-08-26-06 | Repository-wide Rust formatting baseline | `cargo fmt --all -- --check` reports large pre-existing drift across many files outside this scoped change set. | `cargo fmt --all -- --check` outputs >2000 diff lines (terminal log `ca9617ed-...`). | P2 | Deferred to dedicated repo-wide formatting sweep to avoid broad unrelated refactor in this bounded run. | **Open** |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
