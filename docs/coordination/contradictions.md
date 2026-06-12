# Contradiction ledger

**Last updated:** 2026-05-26

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
| WF-001 | `apps/practice-host-ui/src/App.tsx` | `RouteFallback` is spinner-only (`PageLoading`) with no timeout/failure branch; if a lazy chunk stalls, flow can become non-terminable. | `rg "function RouteFallback\|PageLoading label" apps/practice-host-ui/src/App.tsx` | **P1** | Add bounded fallback timeout + explicit retry/error branch and test it. |
| WF-002 | `packages/ui/src/toast-store.ts` | Error toast auto-dismiss is **6000 ms**; spec requires **5000 ms** for error toasts. | `rg "error:\\s*6000" packages/ui/src/toast-store.ts` | **P2** | Change error duration to 5000 ms and add regression test. |
| WF-003 | `packages/ui/src/toast-store.ts` | Toast model has only fixed timed variants (`success/error/info/warning`); no persistent “action-required” state. | `rg "type ToastType\|const DURATION" packages/ui/src/toast-store.ts` | **P2** | Add persistent action-required toast mode + behavior tests. |
| WF-004 | `apps/practice-host-ui/playwright.config.ts` vs `vite.config.ts` | Playwright default `baseURL` is `:5173` while Vite dev server is configured to `:1420`; default geometry/a11y runs target wrong port. | `rg "baseURL\|5173" apps/practice-host-ui/playwright.config.ts`; `rg "port:\\s*1420" apps/practice-host-ui/vite.config.ts` | **P2** | Align Playwright default base URL with Vite web server used in this workspace. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
