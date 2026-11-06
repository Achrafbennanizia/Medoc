/**
 * Typed document template structure (v1) — edited in UI, persisted as JSON, consumed by Rust PDF (no raw HTML).
 */
export type PracticeFieldKey =
    | "name"
    | "address"
    | "phone"
    | "fax"
    | "web"
    | "email"
    | "kv"
    | "tax"
    | "hours"
    | "clinician"
    | "zanr"
    | "bsnr"
    | "bank"
    | "chamber"
    | "kzv"
    | "payment_terms"
    | "vat_notice"
    | "emergency_phone";

export type TextAlignment = "left" | "center" | "right";

export type ExportTableColumnId =
    | "pos"
    | "date"
    | "service_item"
    | "bNr"
    | "quantity"
    | "unit_price"
    | "total"
    | "vat";

export type SignatureKind = "physician" | "stamp" | "both";

export type TemplateFontId = "Helvetica" | "Times" | "Arial";

export type TemplateDensityId = "compact" | "normal" | "spacious";

export type DateFormatId = "de" | "iso";

export interface DocumentTemplatePayloadV1 {
    version: 1;
    header: {
        showLogo: boolean;
        fieldsToShow: PracticeFieldKey[];
        alignment: TextAlignment;
    };
    recipient: {
        visible: boolean;
        alignment: TextAlignment;
    };
    tableColumns: { id: ExportTableColumnId; enabled: boolean }[];
    signature: {
        show: boolean;
        labelKind: SignatureKind;
    };
    /** Plain text, max 240 chars — enforced in editor */
    footer: string;
    font: TemplateFontId;
    bodyPt: number;
    density: TemplateDensityId;
    dateFormat: DateFormatId;
}

export const EXPORT_TABLE_COLUMN_OPTIONS: { id: ExportTableColumnId }[] = [
    { id: "pos" },
    { id: "date" },
    { id: "service_item" },
    { id: "bNr" },
    { id: "quantity" },
    { id: "unit_price" },
    { id: "total" },
    { id: "vat" },
];

export const PRACTICE_FIELD_OPTIONS: { id: PracticeFieldKey }[] = [
    { id: "name" },
    { id: "address" },
    { id: "phone" },
    { id: "fax" },
    { id: "web" },
    { id: "email" },
    { id: "kv" },
    { id: "tax" },
    { id: "hours" },
    { id: "clinician" },
    { id: "zanr" },
    { id: "bsnr" },
    { id: "bank" },
    { id: "chamber" },
    { id: "kzv" },
    { id: "payment_terms" },
    { id: "vat_notice" },
    { id: "emergency_phone" },
];

export function emptyDocumentTemplatePayloadV1(): DocumentTemplatePayloadV1 {
    return {
        version: 1,
        header: {
            showLogo: false,
            fieldsToShow: ["name", "address"],
            alignment: "left",
        },
        recipient: { visible: true, alignment: "left" },
        tableColumns: EXPORT_TABLE_COLUMN_OPTIONS.map((c) => ({ id: c.id, enabled: true })),
        signature: { show: true, labelKind: "physician" },
        footer: "",
        font: "Helvetica",
        bodyPt: 11,
        density: "normal",
        dateFormat: "de",
    };
}

export type DocumentKind =
    | "receipt"
    | "prescription"
    | "certificate"
    | "invoice"
    | "daily_report"
    | "chart"
    | "audit_list";

/** English fallback labels — UI should prefer `documentKindLabel(t, kind)` from `document-template-i18n`. */
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
    receipt: "Receipt",
    prescription: "Prescription",
    certificate: "Certificate",
    invoice: "Invoice",
    daily_report: "Daily report",
    chart: "Patient chart",
    audit_list: "Audit / lists",
};

export type BuiltinTemplateId = "plain" | "practice_logo" | "official";

export interface BuiltinTemplateMeta {
    id: BuiltinTemplateId;
    payload: DocumentTemplatePayloadV1;
}

function payloadVariant(base: DocumentTemplatePayloadV1, patch: Partial<DocumentTemplatePayloadV1>): DocumentTemplatePayloadV1 {
    return {
        ...base,
        ...patch,
        header: { ...base.header, ...patch.header },
        recipient: { ...base.recipient, ...patch.recipient },
    };
}

const base = emptyDocumentTemplatePayloadV1();

export const BUILTIN_TEMPLATES_BY_KIND: Record<DocumentKind, BuiltinTemplateMeta[]> = {
    receipt: [
        {
            id: "plain",
            payload: payloadVariant(base, { footer: "", density: "compact" }),
        },
        {
            id: "practice_logo",
            payload: payloadVariant(base, {
                header: { ...base.header, showLogo: true, fieldsToShow: ["name", "address", "phone", "email", "kv"] },
                density: "normal",
            }),
        },
        {
            id: "official",
            payload: payloadVariant(base, {
                signature: { show: true, labelKind: "both" },
                footer: "",
                density: "spacious",
            }),
        },
    ],
    prescription: [],
    certificate: [],
    invoice: [],
    daily_report: [],
    chart: [],
    audit_list: [],
};

/** Fill array references for kinds that share clinical/financial layouts */
for (const k of ["prescription", "certificate", "invoice", "daily_report", "chart", "audit_list"] as DocumentKind[]) {
    BUILTIN_TEMPLATES_BY_KIND[k] = BUILTIN_TEMPLATES_BY_KIND.receipt.map((t) => ({
        ...t,
        payload: structuredClone(t.payload),
    }));
}

export function templatePayloadToJson(p: DocumentTemplatePayloadV1): string {
    return `${JSON.stringify(p)}\n`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function migrateFieldId(id: unknown): PracticeFieldKey | null {
    if (typeof id !== "string") return null;
    if (PRACTICE_FIELD_OPTIONS.some((o) => o.id === id)) return id as PracticeFieldKey;
    return null;
}

function migrateColumnId(id: unknown): ExportTableColumnId | null {
    if (typeof id !== "string") return null;
    if (EXPORT_TABLE_COLUMN_OPTIONS.some((o) => o.id === id)) return id as ExportTableColumnId;
    return null;
}

function migrateDensity(raw: unknown): TemplateDensityId {
    if (raw === "compact") return "compact";
    if (raw === "spacious") return "spacious";
    return "normal";
}

function migrateSignatureKind(raw: unknown): SignatureKind {
    if (raw === "stamp") return "stamp";
    if (raw === "both") return "both";
    return "physician";
}

function migrateFont(raw: unknown): TemplateFontId {
    if (raw === "Times" || raw === "Arial" || raw === "Helvetica") return raw;
    return "Helvetica";
}

/** Normalize persisted builtin template ids (English only). */
export function migrateBuiltinTemplateId(id: string): BuiltinTemplateId | string {
    return id;
}

/**
 * Parse stored template JSON (English keys only).
 */
export function parseTemplatePayloadJson(raw: string): DocumentTemplatePayloadV1 | null {
    try {
        const j = asRecord(JSON.parse(raw));
        if (!j || j.version !== 1) return null;
        const header = asRecord(j.header);
        const recipient = asRecord(j.recipient);
        if (!header || !recipient) return null;
        const empty = emptyDocumentTemplatePayloadV1();
        const fieldsRaw = header.fieldsToShow;
        const fieldsToShow = Array.isArray(fieldsRaw)
            ? fieldsRaw.map(migrateFieldId).filter((x): x is PracticeFieldKey => x != null)
            : empty.header.fieldsToShow;
        const colsRaw = j.tableColumns;
        const tableColumns = Array.isArray(colsRaw)
            ? colsRaw
                  .map((c) => {
                      const row = asRecord(c);
                      const id = migrateColumnId(row?.id);
                      if (!id) return null;
                      return { id, enabled: row?.enabled !== false };
                  })
                  .filter((x): x is { id: ExportTableColumnId; enabled: boolean } => x != null)
            : empty.tableColumns;
        const signature = asRecord(j.signature);
        const align = (v: unknown, fallback: TextAlignment): TextAlignment =>
            v === "left" || v === "center" || v === "right" ? v : fallback;
        return {
            version: 1,
            header: {
                showLogo: header.showLogo === true,
                fieldsToShow: fieldsToShow.length > 0 ? fieldsToShow : empty.header.fieldsToShow,
                alignment: align(header.alignment, "left"),
            },
            recipient: {
                visible: recipient.visible !== false,
                alignment: align(recipient.alignment, "left"),
            },
            tableColumns: tableColumns.length > 0 ? tableColumns : empty.tableColumns,
            signature: {
                show: signature?.show !== false,
                labelKind: migrateSignatureKind(signature?.labelKind),
            },
            footer: String(j.footer ?? "").slice(0, 240),
            font: migrateFont(j.font),
            bodyPt: typeof j.bodyPt === "number" && Number.isFinite(j.bodyPt) ? Math.min(18, Math.max(8, j.bodyPt)) : 11,
            density: migrateDensity(j.density),
            dateFormat: j.dateFormat === "iso" ? "iso" : "de",
        };
    } catch {
        return null;
    }
}
