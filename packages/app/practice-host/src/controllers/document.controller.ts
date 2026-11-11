import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { ClinicalPdfLayout } from "@/lib/clinical-pdf-layout";
import type { InvoiceInput } from "@/systems/practice-host/controllers/invoice.controller";
import type { ReportPdfInput } from "@/systems/practice-host/controllers/report.controller";

/**
 * Official documents (server-side numbering, registry with SHA-256, audit).
 * Previews (`preview: true`) are watermarked "ENTWURF" and get no number.
 * A second issue for the same source returns a "KOPIE" with the same number.
 */
export type IssuedPdf = {
    documentId: string | null;
    documentNumber: string | null;
    sha256: string;
    pdfBase64: string;
    reprint: boolean;
};

export type ClinicalDocumentKind = "certificate" | "prescription" | "receipt";
/** AU copies: patient (default), employer (no diagnosis), insurer. */
export type CertificateCopyVariant = "patient" | "employer" | "insurer";

export type ClinicalDocumentSource = {
    kind: ClinicalDocumentKind;
    /** certificate.id | prescription.id (comma-separated for a combined sheet) | payment.id */
    sourceId: string;
    copyVariant?: CertificateCopyVariant;
};

export type IssuedDocumentRow = {
    id: string;
    kind: string;
    document_number: string;
    source_id: string | null;
    copy_variant: string;
    patient_id: string | null;
    sha256: string;
    status: "ISSUED" | "CANCELLED";
    cancels_id: string | null;
    issued_by: string;
    issued_at: string;
};

export function pdfBase64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

/** Issued PDF bytes. Accepts camelCase (`pdfBase64`) and snake_case (`pdf_base64`). */
export function issuedPdfBytes(
    pdf: { pdfBase64?: string | null; pdf_base64?: string | null } | null | undefined,
): Uint8Array {
    const b64 = pdf?.pdfBase64 || pdf?.pdf_base64;
    if (typeof b64 !== "string" || b64.length === 0) {
        throw new Error("PDF missing");
    }
    return pdfBase64ToBytes(b64);
}

export async function issueClinicalDocument(
    source: ClinicalDocumentSource,
    layout: ClinicalPdfLayout,
    preview: boolean,
): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("issue_clinical_document", {
        args: {
            kind: source.kind,
            sourceId: source.sourceId,
            layoutJson: JSON.stringify(layout),
            preview,
            copyVariant: source.copyVariant ?? null,
        },
    });
}

/** Drop `null` / `undefined`. The invoice command treats a missing key as empty; `null` is rejected (`expected a string`). */
function omitNulls(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(omitNulls);
    if (value != null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (child == null) continue;
            out[key] = omitNulls(child);
        }
        return out;
    }
    return value;
}

export async function issueInvoice(patientId: string, invoice: InvoiceInput, preview: boolean): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("issue_invoice", {
        args: {
            patientId: patientId ?? "",
            invoice: omitNulls(invoice),
            preview: preview ?? false,
        },
    });
}

export async function cancelIssuedInvoice(documentId: string, reason: string): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("cancel_issued_invoice", { args: { documentId, reason } });
}

export async function reprintIssuedDocument(documentId: string): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("reprint_issued_document", { documentId });
}

export async function issueReportPdf(
    input: ReportPdfInput,
    opts: { preview: boolean; sourceId?: string | null },
): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("issue_report_pdf", {
        args: { input, preview: opts.preview, sourceId: opts.sourceId ?? null },
    });
}

export async function listIssuedDocuments(opts: {
    patientId?: string;
    kind?: string;
    limit?: number;
}): Promise<IssuedDocumentRow[]> {
    return practiceSystem.invoke<IssuedDocumentRow[]>("list_issued_documents", {
        patientId: opts.patientId ?? null,
        kind: opts.kind ?? null,
        limit: opts.limit ?? null,
    });
}

export async function verifyIssuedDocument(sha256: string): Promise<IssuedDocumentRow | null> {
    return practiceSystem.invoke<IssuedDocumentRow | null>("verify_issued_document", { sha256 });
}

/** SHA-256 of a file the user picked (for `verifyIssuedDocument`). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
