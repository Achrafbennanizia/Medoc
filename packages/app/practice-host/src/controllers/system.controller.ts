import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export interface LicenseStatus {
    valid: boolean;
    reason: string | null;
    format?: string | null;
    license: {
        customerId: string;
        edition: string;
        issuedAt: string;
        expiresAt: string;
        maxUsers: number;
        modules: string[];
    } | null;
    licenseV2?: {
        customerId: string;
        edition: string;
        deviceId: string;
        activatedAt: string;
        maxUsers: number;
        modules: string[];
        editionFeatures: string[];
    } | null;
    daysUntilExpiry: number | null;
}

type LicenseRecordRaw = Record<string, unknown>;

function pickString(raw: LicenseRecordRaw, camel: string, snake: string): string {
    const value = raw[camel] ?? raw[snake];
    return typeof value === "string" ? value : "";
}

function pickNumber(raw: LicenseRecordRaw, camel: string, snake: string): number {
    const value = raw[camel] ?? raw[snake];
    return typeof value === "number" ? value : 0;
}

function pickStringArray(raw: LicenseRecordRaw, key: string): string[] {
    const value = raw[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Accept camelCase (current IPC) and legacy snake_case payloads from older builds. */
export function normalizeLicenseStatus(raw: LicenseStatus & LicenseRecordRaw): LicenseStatus {
    const licenseRaw = (raw.license ?? raw.license_v1 ?? null) as LicenseRecordRaw | null;
    const licenseV2Raw = (raw.licenseV2 ?? raw.license_v2 ?? null) as LicenseRecordRaw | null;

    const license = licenseRaw
        ? {
              customerId: pickString(licenseRaw, "customerId", "customer_id"),
              edition: pickString(licenseRaw, "edition", "edition"),
              issuedAt: pickString(licenseRaw, "issuedAt", "issued_at"),
              expiresAt: pickString(licenseRaw, "expiresAt", "expires_at"),
              maxUsers: pickNumber(licenseRaw, "maxUsers", "max_users"),
              modules: pickStringArray(licenseRaw, "modules"),
          }
        : null;

    const licenseV2 = licenseV2Raw
        ? {
              customerId: pickString(licenseV2Raw, "customerId", "customer_id"),
              edition: pickString(licenseV2Raw, "edition", "edition"),
              deviceId: pickString(licenseV2Raw, "deviceId", "device_id"),
              activatedAt: pickString(licenseV2Raw, "activatedAt", "activated_at"),
              maxUsers: pickNumber(licenseV2Raw, "maxUsers", "max_users"),
              modules: pickStringArray(licenseV2Raw, "modules"),
              editionFeatures: pickStringArray(licenseV2Raw, "editionFeatures").length
                  ? pickStringArray(licenseV2Raw, "editionFeatures")
                  : pickStringArray(licenseV2Raw, "edition_features"),
          }
        : null;

    return {
        valid: Boolean(raw.valid),
        reason: typeof raw.reason === "string" ? raw.reason : raw.reason ?? null,
        format: typeof raw.format === "string" ? raw.format : raw.format ?? null,
        license,
        licenseV2,
        daysUntilExpiry:
            typeof raw.daysUntilExpiry === "number"
                ? raw.daysUntilExpiry
                : typeof raw.days_until_expiry === "number"
                  ? raw.days_until_expiry
                  : null,
    };
}

async function invokeLicenseStatus(cmd: "verify_license" | "activate_license" | "current_license_status", args?: { token: string }) {
    const raw = args
        ? await practiceSystem.invoke<LicenseStatus & LicenseRecordRaw>(cmd, args)
        : await practiceSystem.invoke<LicenseStatus & LicenseRecordRaw>(cmd);
    return normalizeLicenseStatus(raw);
}

export const verifyLicense = (token: string) => invokeLicenseStatus("verify_license", { token });

export const activateLicense = (token: string) => invokeLicenseStatus("activate_license", { token });

export const currentLicenseStatus = () => invokeLicenseStatus("current_license_status");

export const clearLicense = () => practiceSystem.invoke<void>("clear_license");

export interface UpdateInfo {
    current_version: string;
    latest_version: string;
    update_available: boolean;
    channel: string;
    release_notes?: string;
    source?: string;
}

export const checkForUpdates = () =>
    practiceSystem.invoke<UpdateInfo>("check_for_updates");

export const installAvailableUpdate = () =>
    practiceSystem.invoke<void>("install_available_update");

export const changePassword = (oldPassword: string, newPassword: string) =>
    practiceSystem.invoke<void>("change_password", { old_password: oldPassword, new_password: newPassword });

export interface SubscriptionPortal {
    url: string;
    provider: string;
    note: string;
}

export const openSubscriptionPortal = () =>
    practiceSystem.invoke<SubscriptionPortal>("open_subscription_portal");

export const getPerfThresholdMs = () => practiceSystem.invoke<number>("get_perf_threshold_ms");

export const setPerfThresholdMs = (ms: number) =>
    practiceSystem.invoke<void>("set_perf_threshold_ms", { ms });

export interface HealthCheck {
    db_ok: boolean;
    db_latency_ms: number;
    audit_chain_ok: boolean;
    audit_broken_at: string | null;
    log_dir_writable: boolean;
    version: string;
}

export const systemHealthCheck = () =>
    practiceSystem.invoke<HealthCheck>("system_health_check");

/* ─────────────────── Auto-update payload (NFA-UPD-01..09) ─────────────── */

export interface UpdatePayload {
    version: string;
    url: string;
    notes: string;
    /** Earliest current_version that can in-place upgrade. */
    min_supported?: string;
    /** Detached signature over the binary; verified by the host (NFA-UPD-04). */
    signature?: string;
}

export type UpdateStatus =
    | { status: "up_to_date"; current: string }
    | { status: "available"; current: string; info: UpdatePayload }
    | { status: "error"; message: string };

/** Returns the running app version (NFA-UPD-10). */
export const currentAppVersion = () =>
    practiceSystem.invoke<string>("current_app_version");

/**
 * Decide whether an update payload is newer than the running version.
 * The HTTPS download/verification is performed by the FE (no heavy HTTP client
 * inside the binary); this command does the version comparison.
 */
export const evaluateUpdatePayload = (payload: UpdatePayload) =>
    practiceSystem.invoke<UpdateStatus>("evaluate_update_payload", { payload });

/* ─────────────────── Subscription / payment (FA-PAY) ───────────────────── */

export interface PaymentMethodRequest {
    /** Provider-issued opaque token (e.g. Stripe `pm_...`). Never the raw PAN. */
    provider_token: string;
}

/** Stores a PCI-safe provider token for the current customer. */
export const attachPaymentMethod = (request: PaymentMethodRequest) =>
    practiceSystem.invoke<void>("attach_payment_method", { request });

/* ─────────────────── Devices (FA-DEV / FA-MIG) ─────────────────────────── */

export interface GdtRecord {
    satzart: string | null;
    patient_id: string | null;
    patient_name: string | null;
    patient_first_name: string | null;
    geburtsdatum: string | null;
    befund: string | null;
    raw_lines: [string, string][];
}

export const parseGdtFile = (path: string) =>
    practiceSystem.invoke<GdtRecord>("parse_gdt_file", { path });

export interface DicomFileInfo {
    path: string;
    size_bytes: number;
    is_dicom: boolean;
}

export const inspectDicomFile = (path: string) =>
    practiceSystem.invoke<DicomFileInfo>("inspect_dicom_file", { path });

export interface ScannedDocument {
    path: string;
    bytes: number;
    modified_unix: number;
}

export const scannerListRecent = (folder: string, limit?: number) =>
    practiceSystem.invoke<ScannedDocument[]>("scanner_list_recent", { folder, limit });

/** Opens OS scan UI (Image Capture, Windows Scan, simple-scan, …). */
export const openSystemScanUtility = () => practiceSystem.invoke<void>("open_system_scan_utility");

/** System print dialog for the main webview (native where supported); fallback: `window.print()`. */
export const openNativePrintDialog = () => practiceSystem.invoke<void>("open_native_print_dialog");

export const scannerAttach = (src: string, archiveRoot: string, patientId: string) =>
    practiceSystem.invoke<string>("scanner_attach", {
        src,
        archive_root: archiveRoot,
        patient_id: patientId,
    });

export const scannerAttachVertrag = (src: string, archiveRoot: string, vertragId: string) =>
    practiceSystem.invoke<string>("scanner_attach_vertrag", {
        src,
        archive_root: archiveRoot,
        vertrag_id: vertragId,
    });

/** Copy into ~/medoc-data/vertraege/{vertragId}/ (or ./medoc-data if no home). */
export const scannerAttachVertragAppData = (src: string, vertragId: string) =>
    practiceSystem.invoke<string>("scanner_attach_vertrag_app_data", {
        src,
        vertrag_id: vertragId,
    });

export const pickVertragPdfFile = () => practiceSystem.invoke<string | null>("pick_vertrag_pdf_file");

/* ─────────────────── Card / SEPA processing (FA-FIN-PAY) ──────────────── */

export interface PaymentRequest {
    invoice_id: string;
    amount_cents: number;
    currency: string;
    method: "cash" | "card" | "sepa_transfer";
}

export interface PaymentReceipt {
    provider: string;
    provider_ref: string;
    status: "approved" | "declined" | "pending";
    timestamp_unix: number;
}

export const processPayment = (request: PaymentRequest) =>
    practiceSystem.invoke<PaymentReceipt>("process_payment", { request });

/** Installierte Bildbetrachter (Pfade), wie vom Backend gescannt. */
export interface DetectedPhotoViewerApp {
    display_name: string;
    path: string;
    rank: number;
}

export const listDetectedPhotoViewerApps = () =>
    practiceSystem.invoke<DetectedPhotoViewerApp[]>("list_detected_photo_viewer_apps");
