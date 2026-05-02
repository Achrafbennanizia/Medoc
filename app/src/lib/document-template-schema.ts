/**
 * Typed document template structure (v1) — edited in UI, persisted as JSON, consumed by Rust PDF (no raw HTML).
 */
export type PraxisFieldKey = "name" | "address" | "phone" | "email" | "kv" | "tax" | "hours";

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
    { id: "pos", label: "Pos.-Nr." },
    { id: "datum", label: "Datum" },
    { id: "leistung", label: "Leistung" },
    { id: "bNr", label: "B-Nr." },
    { id: "menge", label: "Menge" },
    { id: "einzelpreis", label: "Einzelpreis" },
    { id: "gesamt", label: "Gesamt" },
    { id: "ust", label: "USt" },
];

export const PRAXIS_FIELD_OPTIONS: { id: PraxisFieldKey; label: string }[] = [
    { id: "name", label: "Name" },
    { id: "address", label: "Adresse" },
    { id: "phone", label: "Telefon" },
    { id: "email", label: "E-Mail" },
    { id: "kv", label: "KV-Nr." },
    { id: "tax", label: "Steuer-Nr." },
    { id: "hours", label: "Öffnungszeiten" },
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

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
    quittung: "Quittung",
    rezept: "Rezept",
    attest: "Attest",
    rechnung: "Rechnung",
    tagesbericht: "Tagesbericht",
    akte: "Patientenakte",
    audit_list: "Audit / Listen",
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
            name: "Standard sachlich",
            description: "Minimal, schwarzweiß",
            payload: payloadVariant(base, { fusszeile: "Zahlungseingang bestätigt.", dichte: "kompakt" }),
        },
        {
            id: "praxis_logo",
            name: "Praxis mit Logo",
            description: "Kopf mit Logo + Adresse",
            payload: payloadVariant(base, {
                kopf: { ...base.kopf, showLogo: true, fieldsToShow: ["name", "address", "phone", "email", "kv"] },
                dichte: "normal",
            }),
        },
        {
            id: "behoerdlich",
            name: "Behördlich",
            description: "Formell, GoBD-orientiert",
            payload: payloadVariant(base, {
                signatur: { show: true, labelArt: "both" },
                fusszeile: "GoBD-konformer Belegausdruck — Unterschrift/Stempel erforderlich.",
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
