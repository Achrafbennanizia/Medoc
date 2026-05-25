# Wave C — frontend package mapping

**Opened:** 2026-05-25
**Status:** prep only (analysis). Execution deferred until after Wave B.
**Scope:** Categorizes `app/src/lib/`, `app/src/models/`, `app/src/views/components/`, `app/src/services/` for the npm-workspace split. Evidence: `ls`, `Grep` on tracked sources.

## Target npm packages (after Wave D)

| Package | Role | Allowed deps |
|---------|------|-------------|
| `@medoc/shared` | Pure TS: schemas, types, domain utilities, generated rbac/enums | zod, date-fns; **no React, no Tauri, no @/systems/*** |
| `@medoc/ui` | Shared React design-system: presentational components | react, clsx, tailwind-merge; **no @tauri-apps/api, no @/systems/*** |
| `@medoc/system-practice` | Practice-host controllers + ports + adapters + pages | @medoc/shared, @medoc/ui, @tauri-apps/api (in tauri adapter only) |
| `@medoc/system-lan` | LAN controllers + page | @medoc/shared, @medoc/ui |
| `@medoc/system-company` | Company-portal controllers + page | @medoc/shared, @medoc/ui |
| `apps/practice-host-ui` | The Tauri-bound React app (current `app/src/`) | every above |
| `apps/lan-web-client` (optional) | Pure browser client targeting LAN HTTPS | @medoc/shared, @medoc/ui, @medoc/system-practice (HttpPracticeAdapter only) |

---

## `app/src/lib/` mapping (97 files)

### Generated → `@medoc/shared/src/generated/` (3 files)

| File | Notes |
|------|-------|
| `rbac.generated.ts` | Output of `medoc-codegen::rbac`. New `medoc-codegen` writes into `packages/medoc-shared/src/generated/`. |
| `enums.generated.ts` | Output of `medoc-codegen::enums`. |
| `schemas.enums.generated.ts` | Output of `medoc-codegen::enums`. |

### Pure helpers → `@medoc/shared/src/lib/` (no `@/systems/*`, no Tauri, no React) (~50 files)

`abbreviations.ts`, `accent-preset.ts`, `anamnese.ts`, `arbeitsplan-compose.ts`, `arbeitsplan-preferences.ts`, `attest-composer.ts`, `breakpoints.ts`, `client-settings.ts`, `clinical-document-pdf.ts`, `command-palette-data.ts`, `dental.ts`*, `document-template-schema.ts`, `export-delimited.ts`, `i18n.ts`, `integration-capabilities.ts`, `interaction-standards.ts`, `kpi-icon-chrome.ts`, `list-params.ts`, `login-totp-errors.ts`, `medikamente.ts`, `password-policy.ts`, `patient-csv.ts`*, `personal-arbeitsplan.ts`, `plan-next-termin.ts`, `posteingang-config.ts`, `praxis-arbeitszeiten-validation.ts`, `praxis-completeness.ts`, `praxis-header-privacy.ts`, `praxis-praeferenzen-storage.ts`*, `praxis-search-prefs-sync.ts`*, `print-html.ts`, `produkt-form-model.ts`*, `rbac.ts` (consumes `rbac.generated`), `save-download.ts`, `schemas.ts`, `settings-format.ts`, `string-suggest.ts`, `tagesabschluss.ts`*, `termin-availability.ts`*, `termin-calendar-ui.ts`*, `termin-domain.ts`*, `untersuchung.ts`, `utils.ts`, `vertrag-domain.ts`, `verwaltung-hierarchy.ts`, `zahlung-buchung.ts`*.

> **\*** = touches `@/systems/*` per grep. Each needs a closer look: either invert the import (use a system-injected dependency), or move out of "pure" into `@medoc/system-practice/lib/`. Mark UNVERIFIED until each is individually inspected.

Plus all matching `*.test.ts` files (vitest specs co-located).

### Tauri-coupled → `apps/practice-host-ui/src/lib/` (3 files)

| File | Tauri usage |
|------|-------------|
| `native-app-menu-bridge.ts` | `@tauri-apps/api` event/menu bridges |
| `akte-anlagen.ts` | `@tauri-apps/api` blob handling |
| `mac-window-drag.ts` | `@tauri-apps/api` window drag region |

### React (UI) → `@medoc/ui/src/` (1 file)

| File | Notes |
|------|-------|
| `icons.tsx` | shared SVG icon set |

### System-aware (must move into a system package or be rewritten) (~38 files)

These reference `@/systems/*`, `@/controllers/*`, or `@/models/*`. Each is a candidate for **either**:
- moving into `@medoc/system-practice/src/lib/` (if specific to practice host), or
- inverting the dependency (e.g. accept a `controller` function as a parameter), keeping the file in `@medoc/shared`.

Files:

`akte-completeness.ts`, `akte-export.ts`, `akte-validation.ts`, `billing-open-booking.ts`, `billing-release.ts`, `clinical-pdf-layout.ts`, `confirmation-preferences.ts`, `document-print-html.ts`, `export-settings.ts`, `export.ts`, `invoice-leistung.ts`, `native-go-menu.ts`, `onboarding.ts`, `patient-browser-storage.ts`, `patient-detail-rezept-actions.ts`, `patient-detail-utils.ts`, `photo-viewer-apps.ts`, `praxis-planning.ts`, `tagesabschluss-invoice-pdf.ts`, `use-rbac.ts`.

Plus matching `*.test.ts` files.

**Default assignment:** `@medoc/system-practice/src/lib/` (these are practice-host-specific glue). Re-evaluate per-file during Wave C.

---

## `app/src/models/` (UNVERIFIED — not enumerated in this prep)

Likely candidates: `types.ts` → `@medoc/shared/src/types/`. `store/auth-store.ts` etc. → `apps/practice-host-ui/src/store/` (zustand state) or `@medoc/system-practice` if cross-page.

## `app/src/views/components/` (UNVERIFIED — large, deferred)

Each component to be classified:
- Pure presentational (Button, Input, Dialog, …) → `@medoc/ui`
- System-aware (PatientAkteWorkflowDialogs, …) → `@medoc/system-practice/src/components/`
- Layout (AppLayout) → `apps/practice-host-ui/src/views/layouts/`

## `app/src/views/pages/` (~53 not yet migrated)

Same triage: each page moves to either `@medoc/system-practice/src/pages/`, `@medoc/system-lan/src/pages/`, or `@medoc/system-company/src/pages/`. Pages still under `views/pages/` after Wave A are practice-host pages (LAN + company already moved). So default assignment: `@medoc/system-practice/src/pages/`.

---

## Outstanding questions before Wave C executes

1. Should `@medoc/shared` ALSO contain the Zod schemas for IPC payloads, or do those belong to the system that owns the IPC? (Recommendation: shared, because frontend + backend both consume them.)
2. Should `client-settings.ts` (settings shape) stay shared, or belong to `@medoc/system-practice`? (Recommendation: shared — settings touch practice + lan + company portal.)
3. Vite path aliases must be updated in `apps/practice-host-ui/vite.config.ts`: `@/lib/*` → `@medoc/shared/*`, `@/systems/practice-host/*` → `@medoc/system-practice/*`, etc. Mass rewrite across all `.ts`/`.tsx` files.
4. Test layout: each package owns its own vitest config and runs its own tests. CI aggregates.

---

## Order of execution (when Wave C lands)

1. Create the workspace root `package.json` with `"workspaces": ["packages/*", "apps/*"]`. Move `app/package.json` → `apps/practice-host-ui/package.json`.
2. Create `packages/medoc-shared/` skeleton; lift the ~50 pure-helper files + generated TS. Run `npm test -w @medoc/shared`.
3. Create `packages/medoc-ui/` skeleton; lift `icons.tsx` + presentational components from `views/components/`. Run tests.
4. Create `packages/medoc-system-{practice,lan,company}/` skeletons; lift contents from `apps/practice-host-ui/src/systems/*`.
5. Rewrite all import paths via tsc + a perl pass.
6. Re-run `npm run lint`, `npm test`, `npm run build` for the whole workspace.
