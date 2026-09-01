/**
 * Clinical document PDFs (Certificate, Prescription, receipt): structured template + domain body.
 *
 * Architecture (analogous to common document pattern): view/export builds a **data package** (body lines),
 * this layer adds the **letterhead** per template (`header.fieldsToShow`) and **privacy**
 * (Settings › Practice) — Rust renders lines only, no raw HTML.
 */

import type { DocumentTemplatePayloadV1, PracticeFieldKey } from "@/lib/document-template-schema";
import type { InvoicePractice } from "@/lib/invoice-service-item";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import {
    loadPracticeHeaderPrivacy,
    maskPracticeExportToken,
    type PracticeHeaderPrivacyV1,
} from "@/lib/practice-header-privacy";

const HEADER_ORDER: PracticeFieldKey[] = [
    "name",
    "address",
    "phone",
    "fax",
    "web",
    "email",
    "kv",
    "tax",
    "hours",
    "clinician",
    "zanr",
    "bsnr",
    "bank",
    "chamber",
    "kzv",
    "payment_terms",
    "vat_notice",
    "emergency_phone",
];

function formatWeb(p: InvoicePractice): string {
    return (p.web ?? "").trim().replace(/^https?:\/\//i, "");
}

/** Practice header lines for template PDF — selected fields only, masked like invoice PDF. */
export function buildClinicalTemplateHeaderLines(
    payload: DocumentTemplatePayloadV1,
    practice: InvoicePractice,
    privacy: PracticeHeaderPrivacyV1,
): string[] {
    const want = new Set(payload.header.fieldsToShow);
    const lines: string[] = [];

    for (const key of HEADER_ORDER) {
        if (!want.has(key)) continue;
        switch (key) {
            case "name": {
                const n = (practice.name ?? "").trim();
                if (n) lines.push(n);
                break;
            }
            case "address": {
                for (const raw of (practice.addr ?? "").split(/\r?\n/)) {
                    const t = raw.trim();
                    if (t) lines.push(t);
                }
                break;
            }
            case "phone": {
                const t = (practice.phone ?? "").trim();
                if (!t) break;
                lines.push(`Tel. ${privacy.tel ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "fax": {
                const t = (practice.fax ?? "").trim();
                if (!t) break;
                lines.push(`Fax ${privacy.fax ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "web": {
                const w = formatWeb(practice);
                if (!w) break;
                lines.push(privacy.web ? w : maskPracticeExportToken(w));
                break;
            }
            case "email": {
                const t = (practice.email ?? "").trim();
                if (!t) break;
                lines.push(`Email ${privacy.email ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "kv": {
                const t = (practice.kv_number ?? "").trim();
                if (!t) break;
                lines.push(`Health insurance no. ${privacy.kv ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "tax": {
                const ust = (practice.vat_id ?? "").trim();
                if (ust) lines.push(`VAT ID ${privacy.vat ? ust : maskPracticeExportToken(ust)}`);
                const st = (practice.tax_number ?? "").trim();
                if (st) lines.push(`Tax no. ${privacy.tax ? st : maskPracticeExportToken(st)}`);
                break;
            }
            case "hours": {
                const t = (practice.opening_hours ?? "").trim();
                if (!t) break;
                lines.push(`Hrs: ${privacy.hours ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "clinician": {
                const n = (practice.clinician_name ?? "").trim();
                if (!n) break;
                const title = (practice.professional_title ?? "").trim();
                const label = title ? `${n}, ${title}` : n;
                lines.push(`Clinician: ${privacy.clinician ? label : maskPracticeExportToken(label)}`);
                break;
            }
            case "zanr": {
                const t = (practice.zanr ?? "").trim();
                if (!t) break;
                lines.push(`ZANR: ${privacy.zanr ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "bsnr": {
                const t = (practice.bsnr ?? "").trim();
                if (!t) break;
                lines.push(`BSNR: ${privacy.bsnr ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "bank": {
                const iban = (practice.bank_iban ?? "").trim();
                const bic = (practice.bank_bic ?? "").trim();
                const bank = (practice.bank_name ?? "").trim();
                if (!iban && !bic && !bank) break;
                if (iban) lines.push(`IBAN: ${privacy.bank ? iban : maskPracticeExportToken(iban)}`);
                if (bic) lines.push(`BIC: ${privacy.bank ? bic : maskPracticeExportToken(bic)}`);
                if (bank) lines.push(`Bank: ${privacy.bank ? bank : maskPracticeExportToken(bank)}`);
                break;
            }
            case "chamber": {
                const t = (practice.chamber ?? "").trim();
                if (!t) break;
                lines.push(`Chamber: ${t}`);
                break;
            }
            case "kzv": {
                const t = (practice.kzv ?? "").trim();
                if (!t) break;
                lines.push(`KZV: ${t}`);
                break;
            }
            case "payment_terms": {
                const days = practice.payment_terms_days ?? 14;
                if (days > 0) lines.push(`Payment terms: ${days} days`);
                break;
            }
            case "vat_notice": {
                const t = (practice.vat_exemption_notice ?? "").trim();
                if (t) lines.push(t);
                break;
            }
            case "emergency_phone": {
                const t = (practice.emergency_phone ?? "").trim();
                if (!t) break;
                lines.push(`Emergency: ${t}`);
                break;
            }
            default:
                break;
        }
    }

    return lines;
}

/**
 * PDF lines for `preview_document_pdf`: optional header lines (template + privacy) + content.
 */
export function composeClinicalDocumentPdfBodyLines(payload: DocumentTemplatePayloadV1, contentLines: string[]): string[] {
    const practice = getInvoicePracticeFromStorage();
    const privacy = loadPracticeHeaderPrivacy();
    const headerLines = buildClinicalTemplateHeaderLines(payload, practice, privacy);
    if (headerLines.length === 0) return [...contentLines];
    return [...headerLines, "", ...contentLines];
}
