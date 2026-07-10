/**
 * v1 surface feature flags — hide unfinished UI until wired.
 * Re-enable via `docs/coordination/todos-deferred-v1-surfaces.md`.
 */

/** Einstellungen → Lizenz: Nutzung diesen Monat meters (Behandler/Speicher/eRezept). */
export const LICENSE_USAGE_METERS_ENABLED = false;

/** Einstellungen → Lizenz: Zahlungsmethode, Rechnungen, Plan wechseln. */
export const LICENSE_BILLING_CONNECTORS_ENABLED = false;

/** Einstellungen → Lizenz: KBV-Zulassung marketing row. */
export const LICENSE_KBV_ROW_ENABLED = false;

/** Einstellungen → Lizenz: Support-Vertrag marketing row. */
export const LICENSE_SUPPORT_ROW_ENABLED = false;

/** Export dialogs: Dokumentvorlage (PDF-Layout) template picker. */
export const PDF_LAYOUT_TEMPLATE_PICKER_ENABLED = false;

/** NFA-USE-09 route coachmarks (onboarding). */
export const ONBOARDING_COACHMARK_ENABLED = false;

/** Migration wizard: GDT / DICOM / TWAIN live adapter steps (step 3+). */
export const MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED = false;

/** v1 ships HTTP serverless pairing; device network panel stays off in settings. */
export const VERBUND_ADMIN_PANEL_V1_ENABLED = false;

/**
 * Patient Akte header — Task to reception, Request review, Discharge sheet.
 * Dialogs remain wired in `patient-detail.tsx`; re-enable when sell-ready polish is done.
 */
export const PATIENT_AKTE_WORKFLOW_HEADER_BUTTONS_ENABLED = false;
