import type { DocumentKind } from "@/lib/document-template-schema";
import { getInvoicePraxisFromStorage, type InvoicePraxis } from "@/lib/invoice-leistung";

const PRAXIS_SETUP_DISMISS_KEY = "medoc-praxis-setup-dismissed-v1";

export type { DocumentKind };

export type PraxisReadinessResult = {
    ready: boolean;
    missingFields: { field: string; label: string }[];
};

const RULES: Record<
    DocumentKind,
    { field: keyof InvoicePraxis | "addr"; label: string }[]
> = {
    rechnung: [
        { field: "name", label: "Praxisname" },
        { field: "addr", label: "Adresse" },
        { field: "behandler_name", label: "Behandler-Name" },
        { field: "zanr", label: "ZANR" },
        { field: "bsnr", label: "BSNR" },
        { field: "bankverbindung_iban", label: "IBAN" },
    ],
    rezept: [
        { field: "name", label: "Praxisname" },
        { field: "addr", label: "Adresse" },
        { field: "behandler_name", label: "Behandler-Name" },
        { field: "zanr", label: "ZANR" },
        { field: "bsnr", label: "BSNR" },
    ],
    attest: [
        { field: "name", label: "Praxisname" },
        { field: "addr", label: "Adresse" },
        { field: "behandler_name", label: "Behandler-Name" },
        { field: "zanr", label: "ZANR" },
        { field: "bsnr", label: "BSNR" },
    ],
    quittung: [
        { field: "name", label: "Praxisname" },
        { field: "addr", label: "Adresse" },
    ],
    akte: [{ field: "name", label: "Praxisname" }],
    tagesbericht: [{ field: "name", label: "Praxisname" }],
    audit_list: [{ field: "name", label: "Praxisname" }],
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
        .map((r) => ({ field: String(r.field), label: r.label }));
    return { ready: missingFields.length === 0, missingFields };
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

export function praxisReadinessDialogBody(documentKind: DocumentKind, missing: PraxisReadinessResult["missingFields"]): string {
    const labels = missing.map((m) => m.label).join(", ");
    const kindLabel =
        documentKind === "rechnung"
            ? "Rechnungen"
            : documentKind === "rezept"
              ? "Rezepte"
              : documentKind === "attest"
                ? "Atteste"
                : documentKind === "quittung"
                  ? "Quittungen"
                  : documentKind === "tagesbericht"
                    ? "Tagesberichte"
                    : documentKind === "akte"
                      ? "Patientenakten"
                      : "Dokumente";
    return `Für ${kindLabel} werden folgende Angaben benötigt: ${labels}. Bitte unter Einstellungen › Praxis ausfüllen.`;
}
