# Deferred v1 surfaces (TODO)

**Status:** hidden for v1 (2026-06-18). Flags in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts).

## Re-enable checklist

### Regulated connectors

1. Set capability `available: true` in [`integration-capabilities.ts`](../../packages/shared/src/lib/integration-capabilities.ts) when backend is production-ready.
2. **E-Rezept An TI senden** — [`prescriptions.tsx`](../../apps/practice-host-ui/src/views/pages/prescriptions.tsx); wire `submit_eprescription` to TI.
3. **KIM** — add UI only when `send_kim_message` is live.
4. **Migration GDT/DICOM/Scanner** — set `MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED = true`.

### Lizenz section (screenshot blinds)

1. `LICENSE_USAGE_METERS_ENABLED = true`
2. `LICENSE_BILLING_CONNECTORS_ENABLED = true` + company portal production billing
3. `LICENSE_KBV_ROW_ENABLED = true` — wire to real accreditation data
4. `LICENSE_SUPPORT_ROW_ENABLED = true` — wire to portal contract API

### Export / onboarding

1. `PDF_LAYOUT_TEMPLATE_PICKER_ENABLED = true`
2. `ONBOARDING_COACHMARK_ENABLED = true` — restore mount in `app-layout.tsx`
3. `WORKFLOW_ONBOARDING_PREFS_UI_ENABLED = true` — settings reset row in Arbeitsabläufe

### Workflows (Arbeitsabläufe)

1. `WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED = true` — modal vs inline confirm tuning (defaults remain modal when hidden)

### Multi-device

1. `VERBUND_ADMIN_PANEL_V1_ENABLED = true` when Geräteverbund wire ships (v1.1)

### Patient Akte header (record)

1. `PATIENT_AKTE_WORKFLOW_HEADER_BUTTONS_ENABLED = true` in [`v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts)
2. Manual QA: Task to reception (PHYSICIAN), Request review (PHYSICIAN/RECEPTION), Discharge sheet PDF
3. See [`geplant.md`](geplant.md) — Clinical / dental UI section

## Do NOT blind (has runtime effect)

- **Akte confirmations (runtime)** — [`akte-confirm-presentation.tsx`](../../apps/practice-host-ui/src/views/components/akte-confirm-presentation.tsx) still uses stored prefs; only the **settings UI** is hidden.
