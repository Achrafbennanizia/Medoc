# Contradiction ledger

**Last updated:** 2026-06-12

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow findings register (2026-06-12 quality run)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-001 | `apps/practice-host-ui/src/App.tsx` | `RouteFallback` was spinner-only (`PageLoading`) with no timeout/failure branch; lazy chunk stalls could become non-terminable. | `rg "function RouteFallback\|PageLoading label" apps/practice-host-ui/src/App.tsx` (baseline) | **P1** | **Fixed**: timeout + `PageLoadError` retry branch added in `RouteFallback`; guarded by `src/verbund-onboarding-gate.smoke.test.tsx`. |
| WF-002 | `packages/ui/src/toast-store.ts` | Error toast auto-dismiss was **6000 ms**; spec requires **5000 ms** for error toasts. | `rg "error:\\s*6000" packages/ui/src/toast-store.ts` (baseline) | **P2** | **Fixed**: `error` duration set to `5000` and asserted in `component-interaction-matrix.smoke.test.tsx`. |
| WF-003 | `packages/ui/src/toast-store.ts` | Toast model had only fixed timed variants (`success/error/info/warning`); no persistent “action-required” state. | `rg "type ToastType\|const DURATION" packages/ui/src/toast-store.ts` (baseline) | **P2** | **Fixed**: `action_required` toast type added (`durationMs=0`, no progress timer) with regression assertions in `component-interaction-matrix.smoke.test.tsx`. |
| WF-004 | `apps/practice-host-ui/playwright.config.ts` vs `vite.config.ts` | Playwright default `baseURL` was `:5173` while Vite web server is `:1420`; default geometry/a11y runs targeted wrong port. | `rg "baseURL\|5173" apps/practice-host-ui/playwright.config.ts`; `rg "port:\\s*1420" apps/practice-host-ui/vite.config.ts` (baseline) | **P2** | **Fixed**: Playwright base URL aligned to `:1420`; managed preview server now starts for both geometry and UI-rules modes. |
| WF-005 | `apps/practice-host-ui/src/views/components/verbund-onboarding-gate.tsx` | Pre-login gate could loop forever (`status === null`) when `verbundGetStatus()` failed, blocking `/login` and all onboarding/login flows. | Playwright error context (`Verbund-Status wird geladen …` never resolved) + code path `.catch(() => setStatus(null))` | **P1** | **Fixed**: explicit timeout/error branch with retry + “Ohne Verbund fortfahren”; covered by new `verbund-onboarding-gate.smoke.test.tsx` and passing Playwright suites. |
| WF-006 | `apps/practice-host-ui/src/views/pages/login.tsx` | Password field focus ring was suppressed (`boxShadow: "none"` inline), violating visible focus requirement. | `MEDOC_UI_RULES=1` Playwright failures at `expectVisibleFocusRing` for `#passwort` | **P1** | **Fixed**: removed inline `boxShadow` override on password input; `ui-rules.spec.ts` now passes on all breakpoints. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
