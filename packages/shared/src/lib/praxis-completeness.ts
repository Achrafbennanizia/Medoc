import type { DocumentKind } from "@/lib/document-template-schema";
import { getInvoicePraxisFromStorage, type InvoicePraxis } from "@/lib/invoice-leistung";

const PRAXIS_SETUP_DISMISS_KEY = "medoc-praxis-setup-dismissed-v1";

export type { DocumentKind };

export type PraxisReadinessResult = {
    ready: boolean;
    missingFields: { field: string; labelKey: string }[];
};

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

const FIELD_LABEL_KEYS: Partial<Record<keyof InvoicePraxis | "addr", string>> = {
    name: "praxis.setup.practice_name",
    addr: "praxis.setup.address",
    behandler_name: "praxis.setup.behandler",
    zanr: "praxis.setup.zanr",
    bsnr: "praxis.setup.bsnr",
    bankverbindung_iban: "praxis.setup.iban",
    bankverbindung_bic: "praxis.setup.bic",
    bankverbindung_bank: "praxis.setup.bank",
    telefon: "praxis.setup.phone",
    email: "praxis.setup.email",
    berufsbezeichnung: "praxis.setup.berufsbezeichnung",
    steuernummer: "praxis.setup.tax_number",
    ust_id: "praxis.setup.tax_id",
    ust_befreiung_hinweis: "praxis.setup.tax_exempt",
};

const RULES: Record<DocumentKind, { field: keyof InvoicePraxis | "addr" }[]> = {
    rechnung: [
        { field: "name" },
        { field: "addr" },
        { field: "behandler_name" },
        { field: "zanr" },
        { field: "bsnr" },
        { field: "bankverbindung_iban" },
    ],
    rezept: [
        { field: "name" },
        { field: "addr" },
        { field: "behandler_name" },
        { field: "zanr" },
        { field: "bsnr" },
    ],
    attest: [
        { field: "name" },
        { field: "addr" },
        { field: "behandler_name" },
        { field: "zanr" },
        { field: "bsnr" },
    ],
    quittung: [{ field: "name" }, { field: "addr" }],
    akte: [{ field: "name" }],
    tagesbericht: [{ field: "name" }],
    audit_list: [{ field: "name" }],
};

const DOCUMENT_KIND_KEYS: Record<DocumentKind, string> = {
    rechnung: "praxis.readiness.kind.rechnung",
    rezept: "praxis.readiness.kind.rezept",
    attest: "praxis.readiness.kind.attest",
    quittung: "praxis.readiness.kind.quittung",
    tagesbericht: "praxis.readiness.kind.tagesbericht",
    akte: "praxis.readiness.kind.akte",
    audit_list: "praxis.readiness.kind.audit_list",
};

function fieldEmpty(praxis: InvoicePraxis, field: keyof InvoicePraxis | "addr"): boolean {
    if (field === "addr") return !(praxis.addr ?? "").trim();
    const v = praxis[field];
    if (typeof v === "number") return v == null || !Number.isFinite(v) || v <= 0;
    return !(v ?? "").toString().trim();
}

export function checkPraxisDocumentReadiness(
    praxis: InvoicePraxis,
    documentKind: DocumentKind,
): PraxisReadinessResult {
    const rules = RULES[documentKind] ?? RULES.akte;
    const missingFields = rules
        .filter((r) => fieldEmpty(praxis, r.field))
        .map((r) => ({
            field: String(r.field),
            labelKey: FIELD_LABEL_KEYS[r.field] ?? `praxis.setup.${String(r.field)}`,
        }));
    return { ready: missingFields.length === 0, missingFields };
}

export function praxisMissingFieldLabel(t: TFn, field: { labelKey: string }): string {
    return t(field.labelKey);
}

export function shouldShowPraxisSetupWizard(): boolean {
    if (typeof globalThis.localStorage === "undefined") return false;
    if (globalThis.localStorage.getItem(PRAXIS_SETUP_DISMISS_KEY) === "1") return false;
    const p = getInvoicePraxisFromStorage();
    if ((p.name ?? "").trim() === "Zahnarztpraxis") return true;
    return !checkPraxisDocumentReadiness(p, "rechnung").ready;
}

export function dismissPraxisSetupWizard(): void {
    try {
        globalThis.localStorage.setItem(PRAXIS_SETUP_DISMISS_KEY, "1");
    } catch {
        /* ignore */
    }
}

export function praxisReadinessDialogBody(
    t: TFn,
    tp: TParamsFn,
    documentKind: DocumentKind,
    missing: PraxisReadinessResult["missingFields"],
): string {
    const labels = missing.map((m) => t(m.labelKey)).join(", ");
    return tp("praxis.readiness.body", {
        kind: t(DOCUMENT_KIND_KEYS[documentKind]),
        fields: labels,
    });
}
