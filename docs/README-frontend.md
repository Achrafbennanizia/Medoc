# MeDoc desktop frontend — architecture cheat sheet

Paths are relative to `app/` unless noted.

## Stack

- React 19 + Vite 6 + TypeScript
- React Router 7
- Zustand for client state
- Tauri 2 WebView for IPC (`@tauri-apps/api`)

## Data flow: pages → controllers → `tauriInvoke` → Rust

1. **Views** (`src/views/pages/*.tsx`, `views/components/*`) render UI and call **controllers**.
2. **Controllers** (`src/controllers/*.ts`) are the **only** place that should talk to the backend for RPC-shaped operations. They call `tauriInvoke("command_name", { … })` with **snake_case** keys that match `#[tauri::command]` parameters in `app/src-tauri/src/commands/`.
3. **Transport** — `src/services/tauri.service.ts` wraps `invoke` from `@tauri-apps/api/core`. Keep logging/telemetry hooks here if you add them.
4. **Validation** — User-boundary DTOs use Zod in `src/lib/schemas.ts`. Enum literals are imported from `src/models/types.ts` (aligned with Rust `enums.rs` / SQLite `CHECK`s). Controllers use `parseOrThrow` before IPC where applicable.

## RBAC and routing

- **Capabilities** — `src/lib/rbac.ts` (`allowed()`, `ROUTE_VISIBILITY`, `routeChildPathAllowed`). Mirrors `app/src-tauri/src/application/rbac.rs` for IPC enforcement.
- **Route guard** — `views/components/role-route.tsx` uses `routeChildPathAllowed(routePath, rolle)` to block deep links.
- **Session** — `views/components/session-gate.tsx` hydrates Zustand via `get_session` on startup. `models/store/auth-store.ts` holds `session` + `sessionChecked`.

## Stores (Zustand) and cross-cutting UI

- `models/store/auth-store.ts` — session
- `models/store/ui-preferences-store.ts` — confirmation UX prefs (backed by SQLite `app_kv` via `controllers/app-kv.controller.ts`)
- `views/components/ui/toast-store.ts` — toasts
- `models/store/export-preview-store.ts` — print/preview for exports (e.g. DSGVO JSON)

## Design system

- **Primitives** — `views/components/ui/*` (Button, Input, Dialog, Card, …).
- **Global styles** — `src/index.css` (large utility + design-token surface).
- **Icons** — `src/lib/icons.tsx` (SVG set used across nav and actions).
- **i18n** — `src/lib/i18n.ts` (`useT`, locale keys `page.*`).

Keep new screens consistent with existing spacing, typography tokens (`page-title`, `card`, `btn`, etc.), and German copy conventions.

## Storage policy (browser vs SQLite)

Authoritative clinical data lives in **SQLite** (Tauri app data dir). **localStorage / sessionStorage** are used only for:

- **Device UX** — locale (`medoc-locale`), accent (`medoc-accent-preset`), UI zoom (`medoc-ui-zoom` in sessionStorage), pending native menu intents.
- **Optional PII** — remember-email flags/values on login; termin drafts; per-patient legacy keys (being phased toward DB — see `lib/patient-browser-storage.ts` and audit §D in `docs/audit-2026-05.md`).
- **Caches / dev-centric blobs** — practice planning caches, invoice history (legacy), client settings (`lib/client-settings.ts`).

On **DSGVO erase**, `clearPatientScopedBrowserStorage` plus backend pseudonymization runs from `views/pages/datenschutz.tsx` (`ops.controller.ts`).

## Tests

- **Unit / lib** — `src/lib/*.test.ts` (node environment).
- **Critical flows** — `src/critical-flows.smoke.test.tsx` (jsdom) mocks IPC for login shell, termin/zahlung/patient sequences, Tagesabschluss form, DSGVO page. See `docs/definition-of-done-pages.md` for route ↔ smoke mapping.

## Related docs

- Full route DoD matrix: `docs/definition-of-done-pages.md`
- Audit follow-up vs 2026-05 findings: `docs/audit-2026-05-followup.md`
