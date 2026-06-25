# Contradiction ledger

**Last updated:** 2026-06-25

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-06-25 — bounded quality run)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-001 | `cargo clippy --workspace --all-targets -- -D warnings`; `cargo test --workspace --tests` | Rust quality gates are blocked by missing OpenSSL headers for SQLCipher (`openssl/crypto.h` not found). Full backend verification for this run remains blocked. | `libsqlite3-sys` build failure in validation logs (2026-06-25). | **P1** | Install system deps (`libssl-dev`, `pkg-config`) on runner and rerun Rust gates. |
| WF-002 | `apps/practice-host-ui/src/views/pages/login.events.smoke.test.tsx` | Error-path login smoke test was non-terminable/flaky due selector mismatch + stale DOM between tests. | `npm run test` failed with inaccessible textbox/duplicate submit button before patch; now green after selector tightening + `afterEach(cleanup)`. | **P1** | **Fixed** in this run; keep test in suite. |
| WF-003 | `apps/practice-host-ui/src/views/components/behandlung-akte-composer-panel.tsx` | Off-scale arbitrary Tailwind token `min-h-[72px]` bypassed spacing-scale lint policy. | `npm run lint:tailwind-spacing` failure at `behandlung-akte-composer-panel.tsx:265`. | **P2** | **Fixed**: replaced with `min-h-18` and added Tailwind token `18: "4.5rem"` in `tailwind.config.js`. |
| WF-004 | `packages/ui/src/toast-store.ts`, `packages/ui/src/toast.tsx`, `apps/practice-host-ui/src/index.css` | Toast policy diverged from rule-set (error duration 6s, stack top-right, action-required toasts auto-dismissed). | Static inspection + new policy tests. | **P2** | **Fixed**: error=5s, persistent action-required (`durationMs=0`), no auto-dismiss when persistent, stack moved to bottom-right. |
| WF-005 | `apps/practice-host-ui/e2e-playwright/ui-axe-compliance.spec.ts` | No executable axe-core compliance check existed in Playwright suite. | Repo search had no `axe` test harness; added browser test now passing (`0 critical` on `/login`). | **P2** | **Fixed** for login flow; expand to additional pages in follow-up. |
| WF-006 | `packages/ui/src/dialog.tsx` + `dialog.workflow.smoke.test.tsx` | Confirm dialog did not enforce “Enter confirms primary action” policy. | Added smoke test showed missing behavior; now passes with capture listener. | **P2** | **Fixed** in this run; keep regression test. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note suggested connection-order semantics; prior code used `MasterWinsWithFreshness` (master wins timestamp ties) | **Product decision 2026-06-16:** pure **last-write-wins** by `updated_at`; equal timestamps broken by lexicographic `device_id` (no master tie-break). Push-then-pull transport order unchanged. | `merge.rs` + docs updated; Wave 2c E2E tests codify LWW | 2026-06-16 |
