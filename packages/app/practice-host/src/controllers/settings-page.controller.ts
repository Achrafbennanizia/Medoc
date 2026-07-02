/**
 * Central IPC functions for Einstellungen page and embedded sections
 * (LAN host, embedded sections).
 *
 * **`medoc-server` (LAN)** — same practice KV keys as Tauri `get_app_kv` / `set_app_kv`:
 * `GET /api/v1/app-kv?key=…`, `PUT /api/v1/app-kv` with `{ key, value }`, `DELETE /api/v1/app-kv?key=…`
 * (JWT `Bearer`, RBAC as in `application/app_kv_policy.rs`).
 *
 * **Own account (profile):** Tauri `get_own_profile` / `update_own_profile`; LAN mirrors
 * `GET /api/v1/me`, `PATCH /api/v1/me` with JSON body like `UpdateOwnProfile` (changed fields only).
 *
 * **Manufacturer portal (LAN mirror):** with JWT and role `ops.system` — `GET /api/v1/company/summary`,
 * `GET /api/v1/company/integrations/status`, `GET /api/v1/company/feature-flags`, `POST /api/v1/company/billing/portal-session`
 * (empty JSON body). Uses same practice KV configuration as desktop (`company.portal.config.v1`).
 * UI store (`useUiPreferencesStore`), confirmation dialogs — intentionally device-local only.
 */

export {
    attachPaymentMethod,
    changePassword,
    checkForUpdates,
    currentAppVersion,
    installAvailableUpdate,
    type DetectedPhotoViewerApp,
    getPerfThresholdMs,
    listDetectedPhotoViewerApps,
    openSubscriptionPortal,
    type PaymentMethodRequest,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
    type LicenseStatus,
    type UpdateInfo,
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
