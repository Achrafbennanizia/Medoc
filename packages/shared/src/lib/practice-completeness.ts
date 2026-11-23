import { practiceCountry } from "@/lib/document-header-layout";
import type { DocumentKind } from "@/lib/document-template-schema";
import { getInvoicePracticeFromStorage, type InvoicePractice } from "@/lib/invoice-service-item";

const PRACTICE_SETUP_DISMISS_KEY = "medoc-practice-setup-dismissed-v1";

export type { DocumentKind };

export type PracticeReadinessResult = {
    ready: boolean;
    missingFields: { field: string; labelKey: string }[];
};

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

const FIELD_LABEL_KEYS: Partial<Record<keyof InvoicePractice | "addr", string>> = {
    name: "practice.setup.practice_name",
    addr: "practice.setup.address",
    clinician_name: "practice.setup.clinician",
    zanr: "practice.setup.zanr",
    bsnr: "practice.setup.bsnr",
    bank_iban: "practice.setup.iban",
    bank_bic: "practice.setup.bic",
    bank_name: "practice.setup.bank",
    phone: "practice.setup.phone",
    email: "practice.setup.email",
    professional_title: "practice.setup.professional_title",
    tax_number: "practice.setup.tax_number",
    vat_id: "practice.setup.tax_id",
    vat_exemption_notice: "practice.setup.tax_exempt",
    ma_ice: "settings.practice.billing_ma_ice",
    ma_if: "settings.practice.billing_ma_if",
    fr_rpps: "settings.practice.billing_fr_rpps",
};

const RULES: Record<DocumentKind, { field: keyof InvoicePractice | "addr" }[]> = {
    invoice: [
        { field: "name" },
        { field: "addr" },
        { field: "clinician_name" },
        { field: "zanr" },
        { field: "bsnr" },
        { field: "bank_iban" },
    ],
    prescription: [
        { field: "name" },
        { field: "addr" },
        { field: "clinician_name" },
        { field: "zanr" },
        { field: "bsnr" },
    ],
    certificate: [
        { field: "name" },
        { field: "addr" },
        { field: "clinician_name" },
        { field: "zanr" },
        { field: "bsnr" },
    ],
    receipt: [{ field: "name" }, { field: "addr" }],
    chart: [{ field: "name" }],
    daily_report: [{ field: "name" }],
    audit_list: [{ field: "name" }],
};

const DOCUMENT_KIND_KEYS: Record<DocumentKind, string> = {
    invoice: "practice.readiness.kind.invoice",
    prescription: "practice.readiness.kind.prescription",
    certificate: "practice.readiness.kind.certificate",
    receipt: "practice.readiness.kind.receipt",
    daily_report: "practice.readiness.kind.daily_report",
    chart: "practice.readiness.kind.chart",
    audit_list: "practice.readiness.kind.audit_list",
};

function fieldEmpty(practice: InvoicePractice, field: keyof InvoicePractice | "addr"): boolean {
    if (field === "addr") return !(practice.addr ?? "").trim();
    const version = practice[field];
    if (typeof version === "number") return version == null || !Number.isFinite(version) || version <= 0;
    return !(version ?? "").toString().trim();
}

export function checkPracticeDocumentReadiness(
    practice: InvoicePractice,
    documentKind: DocumentKind,
): PracticeReadinessResult {
    // ZANR / BSNR are German numbers. A Moroccan invoice needs ICE and IF instead (CGI art. 145,
    // also checked by the server) and no IBAN; France and the EU need neither set of ids.
    const country = practiceCountry(practice);
    let rules = (RULES[documentKind] ?? RULES.chart).filter(
        (r) => country === "DE" || (r.field !== "zanr" && r.field !== "bsnr"),
    );
    if (country === "MA") {
        rules = rules.filter((r) => r.field !== "bank_iban");
        if (documentKind === "invoice") rules = [...rules, { field: "ma_ice" }, { field: "ma_if" }];
    }
    // France: the prescriber's RPPS number must be on every prescription (art. R.5132-3 CSP).
    if (country === "FR" && documentKind === "prescription") rules = [...rules, { field: "fr_rpps" }];
    const missingFields = rules
        .filter((r) => fieldEmpty(practice, r.field))
        .map((r) => ({
            field: String(r.field),
            labelKey: FIELD_LABEL_KEYS[r.field] ?? `practice.setup.${String(r.field)}`,
        }));
    return { ready: missingFields.length === 0, missingFields };
}

export function practiceMissingFieldLabel(t: TFn, field: { labelKey: string }): string {
    return t(field.labelKey);
}

export function shouldShowPracticeSetupWizard(): boolean {
    if (typeof globalThis.localStorage === "undefined") return false;
    if (globalThis.localStorage.getItem(PRACTICE_SETUP_DISMISS_KEY) === "1") return false;
    const p = getInvoicePracticeFromStorage();
    const name = (p.name ?? "").trim();
    if (name === "Dental practice") return true;
    return !checkPracticeDocumentReadiness(p, "invoice").ready;
}

export function dismissPracticeSetupWizard(): void {
    try {
        globalThis.localStorage.setItem(PRACTICE_SETUP_DISMISS_KEY, "1");
    } catch {
        /* ignore */
    }
}

export function practiceReadinessDialogBody(
    t: TFn,
    tp: TParamsFn,
    documentKind: DocumentKind,
    missing: PracticeReadinessResult["missingFields"],
): string {
    const labels = missing.map((m) => t(m.labelKey)).join(", ");
    return tp("practice.readiness.body", {
        kind: t(DOCUMENT_KIND_KEYS[documentKind]),
        fields: labels,
    });
}
