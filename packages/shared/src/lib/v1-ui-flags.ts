/**
 * v1 surface feature flags — hide unfinished UI until wired.
 * Re-enable via `docs/coordination/todos-deferred-v1-surfaces.md`.
 */

/** Settings → License: usage-this-month meters (providers/storage/e-prescription). */
export const LICENSE_USAGE_METERS_ENABLED = false;

/** Settings → License: payment method, invoices, change plan. */
export const LICENSE_BILLING_CONNECTORS_ENABLED = false;

/** Settings → License: KBV approval marketing row. */
export const LICENSE_KBV_ROW_ENABLED = false;

/** Settings → License: support-contract marketing row. */
export const LICENSE_SUPPORT_ROW_ENABLED = false;

/** Export dialogs: document-template (PDF layout) template picker. */
export const PDF_LAYOUT_TEMPLATE_PICKER_ENABLED = false;

/**
 * Report toolbar **Import…** (JSON/XML round-trip) on Finance, Balance sheet,
 * Audit, Compliance, Analytics — incomplete; re-enable via
 * `docs/coordination/todos-deferred-ui-blinds.md`.
 */
export const REPORT_IMPORT_UI_ENABLED = false;

/** NFA-USE-09 route coachmarks (onboarding). */
export const ONBOARDING_COACHMARK_ENABLED = false;

/** Migration wizard: GDT / DICOM / TWAIN live adapter steps (step 3+). */
export const MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED = false;

/** v1 ships HTTP serverless pairing; device network panel stays off in settings. */
export const CLUSTER_ADMIN_PANEL_V_1_ENABLED = false;

/**
 * Patient Chart header — Task to reception, Request review, Discharge sheet.
 * Dialogs remain wired in `patient-detail.tsx`; re-enable when sell-ready polish is done.
 */
export const PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED = false;
