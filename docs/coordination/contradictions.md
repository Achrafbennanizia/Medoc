# Contradiction ledger

**Last updated:** 2026-06-26

## Workflow quality findings register (2026-06-26 run)

| ID | Location | Finding | Evidence | Severity (P0-P3) | Action |
| -- | -------- | ------- | -------- | ---------------- | ------ |
| WF-2026-06-26-01 | `apps/practice-host-ui/src/g21-routing.smoke.test.tsx`, `apps/practice-host-ui/src/critical-flows.smoke.test.tsx` | Smoke workflows crashed before first render because `WorkflowRouteTracker` called `logWorkflowRouteEnter`, but the mocked `@/services/tauri.service` export was missing. | `npx vitest run src/g21-routing.smoke.test.tsx src/critical-flows.smoke.test.tsx` (pre-fix) -> `No "logWorkflowRouteEnter" export is defined on the "@/services/tauri.service" mock` | P1 | **DONE** in commit `08747cb`: add `logWorkflowRouteEnter` mock in both suites; post-fix targeted run passes (7 passed, 1 skipped). |
| WF-2026-06-26-02 | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-detail-drawer.tsx` | Frontend build is currently non-terminable in CI/release path due TypeScript contract drift (`aufgabeWorkflowStepLabel` export mismatch and bad call arity). | `npm run build` -> TS2724 + TS2554 at lines 43, 213, 226 | P1 | Open dedicated fix PR (code change not in this run). |
| WF-2026-06-26-03 | `crates/shared/medoc-sync/src/verbund/services/lizenz_service.rs:65` | Rust clippy gate fails on `-D warnings` (`clippy::nonminimal_bool`). | `cargo +stable clippy --workspace --all-targets -- -D warnings` -> nonminimal-bool error | P2 | Open dedicated lint fix PR; touches license gating path, request human review before merge. |
| WF-2026-06-26-04 | `apps/practice-host/tests/auth_session_audit_tests.rs:31` | Full Rust workspace tests still fail on auth smoke due quota constraint (`Maximal 1 Arzt-Konto erlaubt`). | `cargo +stable test --workspace --tests` -> `authenticate_succeeds_for_arzt_without_totp_when_2fa_disabled` failed with sqlite code 1811 | P1 | Existing baseline blocker; fix test fixture or quota setup in separate PR. |
| WF-2026-06-26-05 | `packages/shared/src/lib/http-practice.adapter.test.ts:29` | Vitest warns about un-awaited rejection assertion; currently auto-awaited but marked as future failure behavior. | `npm run test` stderr warning: Promise returned by `expect(...).rejects` was not awaited | P3 | Test hygiene follow-up: add `await` before `expect(...).rejects`. |

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
