/**
 * Settings UI feature flags — hide panels until backing services exist.
 * Re-enable when company-portal / push notification microservices are wired.
 */

/** Settings → Notifications (push prefs, portal feature flags). */
export const BENACHRICHTIGUNGEN_SETTINGS_ENABLED = false;

/** Settings → appearance → dark sidebar (sidebar tone toggle). */
export const DARK_SIDEBAR_SETTINGS_ENABLED = false;

/** Appointment calendar: pause/emergency toolbar + Settings toggle (CAL2). */
export const CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED = false;

/** Settings → Integrations (portal stubs, local capability matrix). */
export const INTEGRATIONEN_SETTINGS_ENABLED = false;

/** Settings → Migration (CSV import nav; wizard remains at `/migration` via System). */
export const MIGRATION_SETTINGS_ENABLED = false;

/** Settings → System: only serverless connection (Master/Replica); hides legacy panels. */
export const SYSTEM_SERVERLESS_FOCUS_ENABLED = true;

/** Settings → System: user avatar + keyboard shortcuts (belongs in appearance long-term). */
export const SYSTEM_APPEARANCE_TOGGLES_ENABLED = false;

/** Settings → System: external app for patient-record attachments. */
export const SYSTEM_AKTE_PHOTO_VIEWER_ENABLED = false;

/** Settings → System: auto-logout, health check, performance threshold. */
export const SYSTEM_DIAGNOSTICS_ENABLED = false;

/** Settings → System: full LAN host panel (secondary device client configuration). */
export const SYSTEM_LAN_HOST_PANEL_ENABLED = false;

/** Settings → System: manufacturer portal configuration. */
export const SYSTEM_COMPANY_PORTAL_ENABLED = false;

/** Settings → System: backup, ops embedding, further page links. */
export const SYSTEM_OPS_EXTRAS_ENABLED = false;

/** Settings → System: practice-desktop + LAN-client modes in deployment select. */
export const SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED = false;

/** Settings → System: experimental mesh sync between replicas. */
export const SYSTEM_MESH_SYNC_ENABLED = false;

/** Settings → Workflows: onboarding / introduction reset (NFA-USE-09). */
export const WORKFLOW_ONBOARDING_PREFS_UI_ENABLED = false;

/** Settings → Workflows: modal vs inline tuning for patient-record delete/edit confirms. */
export const WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED = false;
