/**
 * Zentrale IPC-Funktionen für die Einstellungen-Seite sowie eingebettete Bereiche
 * (LAN-Host, eingebettete Bereiche).
 *
 * **`medoc-server` (LAN)** — dieselben Praxis-KV-Schlüssel wie Tauri `get_app_kv` / `set_app_kv`:
 * `GET /api/v1/app-kv?key=…`, `PUT /api/v1/app-kv` mit `{ key, value }`, `DELETE /api/v1/app-kv?key=…`
 * (JWT `Bearer`, RBAC wie `application/app_kv_policy.rs`).
 *
 * **Eigenes Konto (Profil):** Tauri `get_own_profile` / `update_own_profile`; LAN spiegelt
 * `GET /api/v1/me`, `PATCH /api/v1/me` mit JSON-Körper wie `UpdateOwnProfile` (nur geänderte Felder).
 *
 * **Hersteller-Portal (LAN-Spiegel):** mit JWT und Rolle `ops.system` — `GET /api/v1/company/summary`,
 * `GET /api/v1/company/integrations/status`, `GET /api/v1/company/feature-flags`, `POST /api/v1/company/billing/portal-session`
 * (leerer JSON-Körper). Nutzt dieselbe Praxis-KV-Konfiguration wie der Desktop (`company.portal.config.v1`).
 * UI-Store (`useUiPreferencesStore`), Bestätigungsdialoge — bewusst nur auf diesem Gerät.
 */

export {
    attachPaymentMethod,
    changePassword,
    checkForUpdates,
    currentAppVersion,
    type DetectedPhotoViewerApp,
    getPerfThresholdMs,
    listDetectedPhotoViewerApps,
    openSubscriptionPortal,
    type PaymentMethodRequest,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
    type LicenseStatus,
    verifyLicense,
    activateLicense,
    currentLicenseStatus,
    clearLicense,
} from "./system.controller";

export {
    getCompanyPortalConfig,
    setCompanyPortalConfig,
    companyPortalFetchSummary,
    companyPortalFetchIntegrations,
    companyPortalFetchFeatureFlags,
    companyPortalBillingPortalUrl,
    companyPortalAttachPayment,
    companyPortalPing,
    type CompanyPortalConfig,
} from "@/systems/company-portal/controllers/company-portal.controller";

export {
    investigateMyDeviceSession,
    listMyDeviceSessions,
    revokeMyDeviceSession,
    revokeMyOtherDeviceSessions,
    setMyDeviceSessionTrusted,
    type DeviceSessionAuditEntry,
    type DeviceSessionInvestigation,
    type DeviceSessionRow,
} from "./device-session.controller";

export { createBackup } from "./ops.controller";

export { deleteAppKv, getAppKv, setAppKv, type AppKvKey } from "./app-kv.controller";

export * from "@/systems/lan/controllers/lan-server.controller";

export {
    listDokumentTemplatesForKind,
    pickExportDirectory,
    previewDocumentPdf,
    type DokumentTemplateDto,
} from "./document-template.controller";
