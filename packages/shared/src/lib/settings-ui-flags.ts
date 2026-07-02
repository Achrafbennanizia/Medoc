/**
 * Einstellungen UI feature flags — hide panels until backing services exist.
 * Re-enable when company-portal / push notification microservices are wired.
 */

/** Einstellungen → Benachrichtigungen (push prefs, portal feature flags). */
export const BENACHRICHTIGUNGEN_SETTINGS_ENABLED = false;

/** Einstellungen → appearance → dark sidebar (sidebar tone toggle). */
export const DARK_SIDEBAR_SETTINGS_ENABLED = false;

/** Termin-Kalender: Pause/Notfall-Toolbar + Einstellungen-Toggle (CAL2). */
export const CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED = false;

/** Einstellungen → Integrationen (portal stubs, local capability matrix). */
export const INTEGRATIONEN_SETTINGS_ENABLED = false;

/** Einstellungen → Migration (CSV import nav; wizard remains at `/migration` via System). */
export const MIGRATION_SETTINGS_ENABLED = false;

/** Einstellungen → System: only Serverless-Verbindung (Master/Replica); hides legacy panels. */
export const SYSTEM_SERVERLESS_FOCUS_ENABLED = true;

/** Einstellungen → System: user avatar + keyboard shortcuts (belongs in appearance long-term). */
export const SYSTEM_APPEARANCE_TOGGLES_ENABLED = false;

/** Einstellungen → System: external app for Akte attachments. */
export const SYSTEM_AKTE_PHOTO_VIEWER_ENABLED = false;

/** Einstellungen → System: Auto-Abmeldung, Health-Check, Performance-Schwelle. */
export const SYSTEM_DIAGNOSTICS_ENABLED = false;

/** Einstellungen → System: full LAN host panel (secondary device client configuration). */
export const SYSTEM_LAN_HOST_PANEL_ENABLED = false;

/** Einstellungen → System: manufacturer portal configuration. */
export const SYSTEM_COMPANY_PORTAL_ENABLED = false;

/** Einstellungen → System: Backup, Ops-Einbettung, Weitere-Seiten-Links. */
export const SYSTEM_OPS_EXTRAS_ENABLED = false;

/** Einstellungen → System: Betriebsmodi Praxis-Desktop + LAN-Client im Deployment-Select. */
export const SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED = false;

/** Einstellungen → System: experimenteller Mesh-Sync zwischen Replicas. */
export const SYSTEM_MESH_SYNC_ENABLED = false;

/** Einstellungen → Arbeitsabläufe: Einführung / onboarding reset (NFA-USE-09). */
export const WORKFLOW_ONBOARDING_PREFS_UI_ENABLED = false;

/** Einstellungen → Arbeitsabläufe: modal vs inline tuning for Akte delete/edit confirms. */
export const WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED = false;
