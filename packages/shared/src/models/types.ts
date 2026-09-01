// ===== Domain Types (mirrored from Rust backend `app/src-tauri/src/domain/`) =====
// Enum wire values: `config/enums.yaml` → `lib/enums.generated.ts` (via `cargo build`).

export type {
    ChartStatus,
    OrderStatus,
    FeedbackCategory,
    FeedbackStatus,
    Sex,
    PatientStatus,
    Role,
    AppointmentKind,
    AppointmentStatus,
    PaymentMethod,
    PaymentStatus,
} from "@/lib/enums.generated";

export {
    CHART_STATUS_VALUES,
    ORDER_STATUS_VALUES,
    FEEDBACK_CATEGORY_VALUES,
    FEEDBACK_STATUS_VALUES,
    SEX_VALUES,
    PATIENT_STATUS_VALUES,
    ROLE_VALUES,
    APPOINTMENT_KIND_VALUES,
    APPOINTMENT_STATUS_VALUES,
    PAYMENT_METHOD_VALUES,
    PAYMENT_STATUS_VALUES,
} from "@/lib/enums.generated";

import type {
    ChartStatus,
    Sex,
    PatientStatus,
    Role,
    AppointmentKind,
    AppointmentStatus,
    PaymentMethod,
    PaymentStatus,
} from "@/lib/enums.generated";

/** FA-PERS-07 — granular capability overrides (must match backend `PermissionOverride`). */
export type PermissionOverride = { action: string; effect: "ALLOW" | "DENY" };

export interface Session {
    user_id: string;
    name: string;
    email: string;
    role: Role;
    permission_overrides?: PermissionOverride[];
    /** Desktop/browser device session (SQLite `device_session`). */
    device_session_id?: string | null;
}

/** Persisted in SQLite `in_app_notification` (notifications for logged-in staff). */
export interface InAppNotification {
    id: string;
    user_id: string;
    kind: string;
    title: string;
    body: string;
    payload_json: string | null;
    read_at: string | null;
    created_at: string;
}

export interface Staff {
    id: string;
    name: string;
    email: string;
    role: Role;
    activity_area: string | null;
    specialty: string | null;
    phone: string | null;
    available: boolean;
    created_at: string;
    updated_at: string;
}

export interface Patient {
    id: string;
    name: string;
    date_of_birth: string;
    sex: Sex;
    insurance_number: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: PatientStatus;
    created_at: string;
    updated_at: string;
}

export interface Appointment {
    id: string;
    date: string;
    time: string;
    kind: AppointmentKind;
    status: AppointmentStatus;
    notes: string | null;
    chief_complaint: string | null;
    patient_id: string;
    physician_id: string;
    created_at: string;
    updated_at: string;
}

export interface PatientChart {
    id: string;
    patient_id: string;
    status: ChartStatus;
    diagnosis: string | null;
    findings: string | null;
    created_at: string;
    updated_at: string;
}

export interface DentalFinding {
    id: string;
    chart_id: string;
    tooth_number: number;
    finding: string;
    diagnosis: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AnamnesisForm {
    id: string;
    patient_id: string;
    answers: string;
    signed: boolean;
    created_at: string;
    updated_at: string;
}

export interface Examination {
    id: string;
    chart_id: string;
    chief_complaint: string | null;
    results: string | null;
    diagnosis: string | null;
    examination_number?: string | null;
    created_at: string;
    /** FA-LEIST-07 */
    category?: string | null;
    service_name?: string | null;
    total_cost?: number | null;
    /** FA-LEIST-05 */
    released_by_physician_id?: string | null;
    released_at?: string | null;
}

export interface Treatment {
    id: string;
    chart_id: string;
    kind: string;
    description: string | null;
    teeth: string | null;
    material: string | null;
    notes: string | null;
    created_at: string;
    category?: string | null;
    service_name?: string | null;
    treatment_number?: string | null;
    session_number?: number | null;
    treatment_status?: string | null;
    total_cost?: number | null;
    appointment_required?: number | null;
    treatment_date?: string | null;
    /** FA-LEIST-05 */
    released_by_physician_id?: string | null;
    released_at?: string | null;
}

/** Admin: predefined treatment services for record forms (`treatment_catalog`). */
export interface TreatmentCatalogItem {
    id: string;
    category: string;
    name: string;
    default_cost: number | null;
    sort_order: number;
    active: number;
    created_at: string;
}

/** Admin: master data for orders (`supplier_master` / `pharma_consultant_master`). */
export interface SupplierMaster {
    id: string;
    name: string;
    sort_order: number;
    active: number;
    created_at: string;
}

export interface PharmaConsultantMaster {
    id: string;
    name: string;
    sort_order: number;
    active: number;
    created_at: string;
}

/** Predefined combination supplier + pharmaceutical advisor + product (inventory) for new orders. */
export interface SupplierPharmaTemplate {
    id: string;
    supplier_id: string;
    pharma_consultant_id: string;
    product_id: string;
    supplier_name: string;
    pharma_consultant_name: string;
    product_name: string;
    product_category: string;
    product_price: number;
    /** 0/1 — product deactivated in inventory, quick-select hint in UI. */
    product_active: number;
    sort_order: number;
    active: number;
    created_at: string;
}

export interface Payment {
    id: string;
    patient_id: string;
    amount: number;
    payment_method: PaymentMethod;
    status: PaymentStatus;
    service_item_id: string | null;
    description: string | null;
    treatment_id?: string | null;
    examination_id?: string | null;
    amount_expected?: number | null;
    /** 0/1 — day-end close: payment cash-verified. */
    cash_verified?: number;
    created_at: string;
}

export interface BalanceSheet {
    income: number;
    outstanding: number;
    cancelled: number;
    payment_count: number;
}

export interface ServiceItem {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    stock: number;
    min_stock: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    details: string | null;
    under_break_glass: boolean;
    break_glass_reason: string | null;
    created_at: string;
}

/** Mirrors `get_dashboard_stats` — fields are null when the role lacks permission. */
export interface DashboardStats {
    patients_total: number | null;
    appointments_today: number | null;
    revenue_month: number | null;
    products_low: number | null;
}

/** A single bucket in a per-month time series ({@link StatisticsOverview}). */
export interface MonthBucket {
    /** `YYYY-MM` (e.g. `"2026-04"`). */
    month: string;
    value: number;
}

/** Generic `(label, value)` pair used by pie & ranking charts. */
export interface LabelValue {
    label: string;
    value: number;
}

/** Aggregated breakdowns powering the rich statistics page. */
export interface StatisticsOverview {
    // Patients
    patients_total: number;
    new_patients_per_month: MonthBucket[];
    patients_cumulative_per_month: MonthBucket[];
    age_groups: LabelValue[];
    sexes: LabelValue[];
    patient_status: LabelValue[];
    // Treatments
    treatments_by_category: LabelValue[];
    treatments_per_month: MonthBucket[];
    /** WAAD 9.5 — disease patterns (category/type) and monthly course. */
    disease_patterns_top: LabelValue[];
    disease_patterns_monthly: MonthBucket[];
    medications_top: LabelValue[];
    // Appointments & organisation
    appointments_per_month: MonthBucket[];
    appointment_status: LabelValue[];
    appointment_kind: LabelValue[];
    // Finance
    income_per_month: MonthBucket[];
    revenue_by_payment_method: LabelValue[];
    income_current_month: number;
    // Orders
    orders_by_status: LabelValue[];
    orders_per_month: MonthBucket[];
    products_low: number;
}

/** Practice absences / vacation blocks (`absence` table). */
export interface Absence {
    id: string;
    kind: string;
    comment: string | null;
    from_day: string;
    to_day: string;
    from_time: string | null;
    to_time: string | null;
    created_at: string;
    updated_at: string;
}

/** Admin template for prescriptions or certificates (`document_template`). */
export type DocumentTemplateKind = "PRESCRIPTION" | "CERTIFICATE";

/** Normalize document template kind (English only). */
export function normalizeDocumentTemplateKind(raw: string | null | undefined): DocumentTemplateKind | null {
    const k = (raw ?? "").trim().toUpperCase();
    if (k === "PRESCRIPTION") return "PRESCRIPTION";
    if (k === "CERTIFICATE") return "CERTIFICATE";
    return null;
}

export interface DocumentTemplate {
    id: string;
    kind: DocumentTemplateKind;
    title: string;
    payload: string;
    created_at: string;
    updated_at: string;
}
