/**
 * Typed document template structure (v1) — edited in UI, persisted as JSON, consumed by Rust PDF (no raw HTML).
 */
export type PraxisFieldKey =
    | "name"
    | "address"
    | "phone"
    | "fax"
    | "web"
    | "email"
    | "kv"
    | "tax"
    | "hours"
    | "behandler"
    | "zanr"
    | "bsnr"
    | "bank"
    | "kammer"
    | "kzv"
    | "zahlungsziel"
    | "ust_hinweis"
    | "notfall_tel";

export type TextAlignment = "left" | "center" | "right";

export type ExportTableColumnId =
    | "pos"
    | "datum"
    | "leistung"
    | "bNr"
    | "menge"
    | "einzelpreis"
    | "gesamt"
    | "ust";

export type SignaturArt = "arzt" | "stempel" | "both";

export type SchriftartId = "Helvetica" | "Times" | "Arial";

export type DichteId = "kompakt" | "normal" | "weit";

export type DatumsformatId = "de" | "iso";

export interface DocumentTemplatePayloadV1 {
    version: 1;
    kopf: {
        showLogo: boolean;
        fieldsToShow: PraxisFieldKey[];
        alignment: TextAlignment;
    };
    empfaenger: {
        visible: boolean;
        alignment: TextAlignment;
    };
    tableColumns: { id: ExportTableColumnId; enabled: boolean }[];
    signatur: {
        show: boolean;
        labelArt: SignaturArt;
    };
    /** Plain text, max 240 chars — enforced in editor */
    fusszeile: string;
    schriftart: SchriftartId;
    bodyPt: number;
    dichte: DichteId;
    datumsformat: DatumsformatId;
}

export const EXPORT_TABLE_COLUMN_OPTIONS: { id: ExportTableColumnId; label: string }[] = [
    { id: "pos", label: "Item no." },
    { id: "datum", label: "Date" },
    { id: "leistung", label: "Service" },
    { id: "bNr", label: "Invoice no." },
    { id: "menge", label: "Quantity" },
    { id: "einzelpreis", label: "Unit price" },
    { id: "gesamt", label: "Total" },
    { id: "ust", label: "VAT" },
];

/** English fallback labels — UI should prefer `praxisFieldLabel(t, id)` from `document-template-i18n`. */
export const PRAXIS_FIELD_OPTIONS: { id: PraxisFieldKey; label: string }[] = [
    { id: "name", label: "Name" },
    { id: "address", label: "Address" },
    { id: "phone", label: "Phone" },
    { id: "fax", label: "Fax" },
    { id: "web", label: "Web" },
    { id: "email", label: "Email" },
    { id: "kv", label: "Health insurer no." },
    { id: "tax", label: "Tax no." },
    { id: "hours", label: "Opening hours" },
    { id: "behandler", label: "Treating clinician" },
    { id: "zanr", label: "Dental license no." },
    { id: "bsnr", label: "Practice site no." },
    { id: "bank", label: "Bank details" },
    { id: "kammer", label: "Chamber" },
    { id: "kzv", label: "Regional dental association" },
    { id: "zahlungsziel", label: "Payment terms" },
    { id: "ust_hinweis", label: "VAT notice" },
    { id: "notfall_tel", label: "Emergency phone" },
];

export function emptyDocumentTemplatePayloadV1(): DocumentTemplatePayloadV1 {
    return {
        version: 1,
        kopf: {
            showLogo: false,
            fieldsToShow: ["name", "address"],
            alignment: "left",
        },
        empfaenger: { visible: true, alignment: "left" },
        tableColumns: EXPORT_TABLE_COLUMN_OPTIONS.map((c) => ({ id: c.id, enabled: true })),
        signatur: { show: true, labelArt: "arzt" },
        fusszeile: "",
        schriftart: "Helvetica",
        bodyPt: 11,
        dichte: "normal",
        datumsformat: "de",
    };
}

export type DocumentKind =
    | "quittung"
    | "rezept"
    | "attest"
    | "rechnung"
    | "tagesbericht"
    | "akte"
    | "audit_list";

/** English fallback labels — UI should prefer `documentKindLabel(t, kind)` from `document-template-i18n`. */
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
    quittung: "Receipt",
    rezept: "Prescription",
    attest: "Certificate",
    rechnung: "Invoice",
    tagesbericht: "Daily report",
    akte: "Patient chart",
    audit_list: "Audit / lists",
};

export type BuiltinTemplateId = "sachlich" | "praxis_logo" | "behoerdlich";

export interface BuiltinTemplateMeta {
    id: BuiltinTemplateId;
    name: string;
    description: string;
    payload: DocumentTemplatePayloadV1;
}

function payloadVariant(base: DocumentTemplatePayloadV1, patch: Partial<DocumentTemplatePayloadV1>): DocumentTemplatePayloadV1 {
    return { ...base, ...patch, kopf: { ...base.kopf, ...patch.kopf }, empfaenger: { ...base.empfaenger, ...patch.empfaenger } };
}

const base = emptyDocumentTemplatePayloadV1();

export const BUILTIN_TEMPLATES_BY_KIND: Record<DocumentKind, BuiltinTemplateMeta[]> = {
    quittung: [
        {
            id: "sachlich",
            name: "Plain standard",
            description: "Minimal, black and white",
            payload: payloadVariant(base, { fusszeile: "Payment received.", dichte: "kompakt" }),
        },
        {
            id: "praxis_logo",
            name: "Practice with logo",
            description: "Header with logo + address",
            payload: payloadVariant(base, {
                kopf: { ...base.kopf, showLogo: true, fieldsToShow: ["name", "address", "phone", "email", "kv"] },
                dichte: "normal",
            }),
        },
        {
            id: "behoerdlich",
            name: "Formal / official",
            description: "Formal, GoBD-oriented",
            payload: payloadVariant(base, {
                signatur: { show: true, labelArt: "both" },
                fusszeile: "GoBD-compliant receipt printout — signature/stamp required.",
                dichte: "weit",
            }),
        },
    ],
    rezept: [],
    attest: [],
    rechnung: [],
    tagesbericht: [],
    akte: [],
    audit_list: [],
};

/** Fill array references for kinds that share clinical/financial layouts */
for (const k of ["rezept", "attest", "rechnung", "tagesbericht", "akte", "audit_list"] as DocumentKind[]) {
    BUILTIN_TEMPLATES_BY_KIND[k] = BUILTIN_TEMPLATES_BY_KIND.quittung.map((t) => ({
        ...t,
        payload: structuredClone(t.payload),
    }));
}

export function templatePayloadToJson(p: DocumentTemplatePayloadV1): string {
    return `${JSON.stringify(p)}\n`;
}

export function parseTemplatePayloadJson(raw: string): DocumentTemplatePayloadV1 | null {
    try {
        const j = JSON.parse(raw) as DocumentTemplatePayloadV1;
        if (j?.version !== 1 || !j.kopf || !j.empfaenger) return null;
        return j;
    } catch {
        return null;
    }
}
