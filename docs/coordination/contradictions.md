# Contradiction ledger

**Last updated:** 2026-07-09

## Workflow / UI quality findings register (2026-07-09)

| ID | Location | Finding | Evidence | Severity | Action | Status |
| -- | -------- | ------- | -------- | -------- | ------ | ------ |
| WF-001 | `apps/practice-host-ui/src/views/components/session-gate.tsx` | Session gate could wait indefinitely if `checkSession()` never resolved. | `npm run test` failure + `session-gate.behavior.smoke.test.tsx` timeout case; code had no timeout branch prior to fix. | P1 | Added `withTimeout(..., 7000)` and behavior smoke coverage. | **Resolved** |
| WF-008 | `apps/practice-host-ui/src/views/pages/sonder-sperrzeiten.tsx` | Initial load failure was silent (no user-visible error/retry). | Workflow audit + `sonder-sperrzeiten.behavior.smoke.test.tsx` failure path. | P1 | Added `loadError` + `PageLoadError` retry flow and smoke test. | **Resolved** |
| WF-009 | `apps/practice-host-ui/src/views/components/ui/dialog.tsx`, `packages/ui/src/dialog.tsx` | Confirm dialog cancel/escape path could be blocked while confirm was `loading`. | UI behavior audit + `dialog.behavior.smoke.test.tsx` expectations. | P1 | Kept cancel enabled during loading; close handler no longer gated by loading. | **Resolved** |
| WF-010 | `apps/practice-host-ui/src/views/pages/rezepte.tsx` | Create/eRezept dialogs had busy-state trap with no dismiss path while mutation was active. | Workflow map + manual code review in dialog close handlers. | P1 | Allow close/cancel while busy; reset form on close. | **Resolved** |
| QA-PLAY-001 | `apps/practice-host-ui/playwright.config.ts` | Playwright config used `__dirname` in ESM context; suite could not run. | `npm run test:playwright -- e2e-playwright/ui-geometry-spacing.spec.ts` → `ReferenceError: __dirname is not defined`. | P2 | Replaced with `fileURLToPath(import.meta.url)` + `path.dirname`. | **Resolved** |
| QA-PLAY-002 | `apps/practice-host-ui/e2e-playwright/ui-geometry-spacing.spec.ts` | Spacing assertion used CSS token vars only, diverging from Tailwind spacing scale under 14px root font size. | Playwright failure: `spacing-box padding-left: expected 14px to match spacing token scale`. | P2 | Resolved spacing allow-list from `tailwind.config.js` via `resolveConfig` + root font conversion. | **Resolved** |
| QA-PLAY-003 | `apps/practice-host-ui/e2e-playwright/ui-geometry-spacing.spec.ts` | Toast position assertion incorrectly expected computed `top === "auto"`; computed style returns used px values. | Playwright failure: expected `"auto"`, received pixel value for `top`. | P3 | Switched to geometry assertion (`rectBottom` near viewport bottom). | **Resolved** |
| QA-TEST-001 | `packages/shared/src/lib/http-practice.adapter.test.ts` | One Vitest assertion is not awaited; currently warning-only but could fail on stricter Vitest behavior. | `npm run test` warning: `Promise returned by expect(...).rejects.toThrow(...) was not awaited`. | P3 | Add explicit `await` on rejects assertion in follow-up test-hygiene pass. | **Open** |
| QA-LINT-001 | `apps/practice-host-ui/src` (multiple files) | Optional `npm run lint` gate currently fails with pre-existing hooks/compiler lint issues outside this patch scope. | `npm run lint` → 14 errors / 26 warnings (hooks-order + react-compiler diagnostics). | P2 | Track a dedicated lint-remediation pass; not part of the required user matrix for this run. | **Open** |

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
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
