import { deriveAttachmentDisplayName } from "./chart-attachments";
import { formatDate, formatDateTime } from "@/lib/utils";
import { t, translateLocaleParams, useLocale } from "@/lib/i18n";
import type { PrescriptionLine } from "@/lib/medications";
import type { CertificateComposerFormFields } from "@/lib/certificate-composer";
import type { Treatment, TreatmentCatalogItem } from "@/models/types";
import { EXAMINATION_CATALOG_CATEGORY } from "./treatment-catalog-categories";

type TFn = (key: string) => string;

export function validatePrescriptionLine(line: PrescriptionLine, t: TFn): string | null {
    if (!line.medication.trim()) return t("page.prescriptions.validation.med_required");
    if (!line.dosage.trim()) return t("page.prescriptions.validation.dosage_required");
    if (!line.duration.trim()) return t("page.prescriptions.validation.duration_required");
    return null;
}

export function isPatientChartMissingError(e: unknown): boolean {
    const m = e instanceof Error ? e.message : String(e);
    return m.includes("PatientChart not found") || /PatientChart.*?not found/i.test(m);
}

export const PATIENT_DETAIL_TAB_IDS = ["anamnesis", "examination", "treatment", "prescription", "attachment", "payment"] as const;
export type PatientDetailChartTab = (typeof PATIENT_DETAIL_TAB_IDS)[number];

/** Default chart sub-nav tab when no hash is present (MasterData live in the hero header). */
export function patientDetailDefaultTab(canViewClinical: boolean): PatientDetailChartTab {
    return canViewClinical ? "anamnesis" : "prescription";
}

/** Tabs that require `patient.read_medical` (GAP-01 / REZ need-to-know). */
export const CLINICAL_PATIENT_DETAIL_TABS = ["anamnesis", "examination", "treatment"] as const satisfies readonly PatientDetailChartTab[];

export function patientDetailTabBlocked(tab: PatientDetailChartTab, canViewClinical: boolean): boolean {
    if (canViewClinical) return false;
    return (CLINICAL_PATIENT_DETAIL_TABS as readonly PatientDetailChartTab[]).includes(tab);
}

/** Whether the chart sub-nav tab should render (RBAC: hide blocked tabs for RECEPTION). */
export function patientDetailTabVisible(tab: PatientDetailChartTab, canViewClinical: boolean): boolean {
    return !patientDetailTabBlocked(tab, canViewClinical);
}

export type PrescriptionWizardStep = null | "pick" | "compose" | "ask_template" | "name_template";
export type CertificateWizardStep = null | "pick" | "compose" | "ask_template" | "name_template";

/** Confirmation only for sensitive actions (templates + prescriptions, Attachments). */
export type ChartSavePending =
    | { kind: "prescription_finalize_template"; title: string; lines: PrescriptionLine[]; shared: string }
    | { kind: "certificate_finalize_template"; title: string; fields: CertificateComposerFormFields }
    | { kind: "attachment_add"; file: File; documentKind?: string }
    | { kind: "attachment_remove"; id: string; name: string };

export const PATIENT_DETAIL_TOAST_UNDO_MS = 5200;

export function chartSaveConfirmUi(p: ChartSavePending): { title: string; message: string; confirmLabel: string } {
    const locale = useLocale.getState().locale;
    const tp = (key: string, params: Record<string, string | number>) =>
        translateLocaleParams(locale, key, params);
    switch (p.kind) {
        case "prescription_finalize_template":
            return {
                title: t("patient.detail.confirm.prescription_template_title"),
                message: tp("patient.detail.confirm.prescription_template_message", {
                    title: p.title,
                    count: p.lines.length,
                    suffix: p.lines.length === 1 ? "" : "n",
                }),
                confirmLabel: t("common.save"),
            };
        case "certificate_finalize_template":
            return {
                title: t("patient.detail.confirm.certificate_template_title"),
                message: tp("patient.detail.confirm.certificate_template_message", { title: p.title }),
                confirmLabel: t("common.save"),
            };
        case "attachment_add":
            return {
                title: t("patient.detail.confirm.attachment_add_title"),
                message: tp("patient.detail.confirm.attachment_add_message", {
                    name: deriveAttachmentDisplayName(p.file),
                }),
                confirmLabel: t("common.add"),
            };
        case "attachment_remove":
            return {
                title: t("patient.detail.confirm.attachment_remove_title"),
                message: tp("patient.detail.confirm.attachment_remove_message", { name: p.name }),
                confirmLabel: t("common.remove"),
            };
        default:
            return {
                title: t("patient.detail.confirm.generic_title"),
                message: t("patient.detail.confirm.generic_message"),
                confirmLabel: t("common.ok"),
            };
    }
}

export function patientDetailTabFromHash(hash: string): PatientDetailChartTab | null {
    const h = hash.replace(/^#/, "");
    if (h === "master") return null;
    return PATIENT_DETAIL_TAB_IDS.includes(h as PatientDetailChartTab) ? (h as PatientDetailChartTab) : null;
}

/** Resolves hash to tab id; legacy `#master` maps to the default tab. */
export function resolvePatientDetailTabFromHash(
    hash: string,
    canViewClinical: boolean,
): PatientDetailChartTab | null {
    const h = hash.replace(/^#/, "");
    if (h === "master") return patientDetailDefaultTab(canViewClinical);
    return patientDetailTabFromHash(hash);
}

export function prescriptionStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "ISSUED") return { variant: "success", label: t("enum.prescription_status.issued") };
    if (s === "DRAFT") return { variant: "warning", label: t("enum.prescription_status.draft") };
    return { variant: "default", label: s || "—" };
}

/** Default examination service from the treatment catalog (lowest `sort_order` in category). */
export function resolveDefaultExaminationCatalogItem(
    catalog: TreatmentCatalogItem[],
): TreatmentCatalogItem | null {
    const active = catalog.filter((k) => k.active !== 0);
    const category = EXAMINATION_CATALOG_CATEGORY.toLowerCase();
    const inCategory = active.filter((k) => k.category.trim().toLowerCase() === category);
    if (inCategory.length === 0) return null;
    return (
        [...inCategory].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        )[0] ?? null
    );
}

export function resolveCatalogIdForTreatment(catalog: TreatmentCatalogItem[], b: Treatment): string {
    const name = (b.service_name || b.description || "").trim();
    if (!name) return "";
    const exact = catalog.find((k) => k.name === name);
    if (exact) return exact.id;
    const sub = catalog.find((k) => name.includes(k.name) || k.name.includes(name));
    return sub?.id ?? "";
}

export function treatmentToUpdatePayload(b: Treatment) {
    return {
        id: b.id,
        kind: b.kind,
        description: b.description,
        teeth: b.teeth,
        material: b.material,
        notes: b.notes,
        category: b.category ?? null,
        service_name: b.service_name ?? null,
        treatment_number: b.treatment_number,
        session_number: b.session_number,
        treatment_status: b.treatment_status,
        total_cost: b.total_cost,
        appointment_required: (b.appointment_required ?? 0) === 1,
        treatment_date: b.treatment_date,
    };
}

export function treatmentContinueLabel(b: Treatment): string {
    const bn = (b.treatment_number ?? "").trim() || "—";
    const sitz = b.session_number != null ? String(b.session_number) : "?";
    const title = b.service_name || b.description || b.kind;
    const d = b.treatment_date ? formatDate(b.treatment_date) : formatDateTime(b.created_at);
    return `${bn} · Session ${sitz} · ${title} · ${d}`;
}

export function alterAusDateOfBirth(date_of_birth: string): number | null {
    const raw = date_of_birth.slice(0, 10);
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1;
    return Math.max(0, a);
}
