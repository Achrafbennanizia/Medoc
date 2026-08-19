# Deferred features — Datenschutz (DSGVO) (TODO)

**Status:** UI hidden / disabled in runtime (2026-06-10).  
**Backend:** `dsgvo_export_patient` / `dsgvo_erase_patient` IPC remain available for later wiring.

## Re-enable checklist

1. **`packages/shared/src/lib/privacy-config.ts`** — set `DATENSCHUTZ_UI_ENABLED = true`.
2. **`packages/shared/src/lib/rbac.ts`** — route gate in `routeChildPathAllowed` will allow `privacy` again.
3. **`packages/shared/src/lib/native-go-menu.ts`** — native „Gehe zu“ and `helpShowDatenschutz` menu item.
4. **`packages/shared/src/lib/command-palette-data.ts`** — palette entry auto-filtered via `routeChildPathAllowed`.
5. **`packages/app/practice-host/src/pages/settings/settings-sicherheit-section.tsx`** — „Datenexport (DSGVO)“ link reappears when enabled; update [`geplant.md`](geplant.md).
6. **`apps/practice-host-ui/src/App.tsx`** — route `/privacy` (already registered; gated by `RoleRoute`).
7. **Tests** — re-enable `critical-flows.smoke.test.tsx` DSGVO flow (`describe.skipIf(!DATENSCHUTZ_UI_ENABLED)`).
8. **Docs** — Pflichtenheft DSGVO workflow, onboarding/help copy if needed.

## Evidence

- Gate module: `packages/shared/src/lib/privacy-config.ts`
- Page: `apps/practice-host-ui/src/views/pages/privacy.tsx`
- RBAC: `config/rbac.yaml` (`ops.dsgvo` + `patient.read`)
