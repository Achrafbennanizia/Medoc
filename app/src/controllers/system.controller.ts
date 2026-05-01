import { tauriInvoke } from "@/services/tauri.service";

export interface LicenseStatus {
    valid: boolean;
    reason: string | null;
    license: {
        customer_id: string;
        edition: string;
        issued_at: string;
        expires_at: string;
        max_users: number;
        modules: string[];
    } | null;
    days_until_expiry: number | null;
}

export interface UpdateInfo {
    current_version: string;
    latest_version: string;
    update_available: boolean;
    channel: string;
}

export const verifyLicense = (token: string) =>
    tauriInvoke<LicenseStatus>("verify_license", { token });

export const checkForUpdates = () =>
    tauriInvoke<UpdateInfo>("check_for_updates");

export const changePassword = (oldPassword: string, newPassword: string) =>
    tauriInvoke<void>("change_password", { oldPassword, newPassword });

export interface SubscriptionPortal {
    url: string;
    provider: string;
    note: string;
}

export const openSubscriptionPortal = () =>
    tauriInvoke<SubscriptionPortal>("open_subscription_portal");

export const getPerfThresholdMs = () => tauriInvoke<number>("get_perf_threshold_ms");

export const setPerfThresholdMs = (ms: number) =>
    tauriInvoke<void>("set_perf_threshold_ms", { ms });

export interface HealthCheck {
    db_ok: boolean;
    db_latency_ms: number;
    audit_chain_ok: boolean;
    audit_broken_at: string | null;
    log_dir_writable: boolean;
    version: string;
}

export const systemHealthCheck = () =>
    tauriInvoke<HealthCheck>("system_health_check");

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
    tauriInvoke<string>("current_app_version");

/**
 * Decide whether an update payload is newer than the running version.
 * The HTTPS download/verification is performed by the FE (no heavy HTTP client
 * inside the binary); this command does the version comparison.
 */
export const evaluateUpdatePayload = (payload: UpdatePayload) =>
    tauriInvoke<UpdateStatus>("evaluate_update_payload", { payload });

/* ─────────────────── Subscription / payment (FA-PAY) ───────────────────── */

export interface PaymentMethodRequest {
    /** Provider-issued opaque token (e.g. Stripe `pm_...`). Never the raw PAN. */
    provider_token: string;
}

/** Stores a PCI-safe provider token for the current customer. */
export const attachPaymentMethod = (request: PaymentMethodRequest) =>
    tauriInvoke<void>("attach_payment_method", { request });

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
    tauriInvoke<GdtRecord>("parse_gdt_file", { path });

export interface DicomFileInfo {
    path: string;
    size_bytes: number;
    is_dicom: boolean;
}

export const inspectDicomFile = (path: string) =>
    tauriInvoke<DicomFileInfo>("inspect_dicom_file", { path });

export interface ScannedDocument {
    path: string;
    bytes: number;
    modified_unix: number;
}

export const scannerListRecent = (folder: string, limit?: number) =>
    tauriInvoke<ScannedDocument[]>("scanner_list_recent", { folder, limit });

export const scannerAttach = (src: string, archiveRoot: string, patientId: string) =>
    tauriInvoke<string>("scanner_attach", {
        src,
        archiveRoot,
        patientId,
    });

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
    tauriInvoke<PaymentReceipt>("process_payment", { request });
