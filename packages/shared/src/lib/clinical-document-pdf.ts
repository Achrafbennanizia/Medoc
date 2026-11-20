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
import { SUPPORTED_LOCALES, translateLocale, translateLocaleParams } from "@/lib/i18n";
import { isolateLtrPhone } from "@/lib/arabic-numerals";
import { documentLocaleForI18n } from "@/lib/document-locale";

/**
 * Header labels in the document language. They were hard-coded English
 * ("VAT ID", "Tax no.", "Clinician:", "Emergency:" …) and phone/fax used the
 * UI language, so a German or Arabic document carried English labels.
 */
const docT = (key: string) => translateLocale(documentLocaleForI18n(), key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(documentLocaleForI18n(), key, params);

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
                const tel = docT("document.print.phone");
                lines.push(`${tel} ${privacy.tel ? isolateLtrPhone(t) : maskPracticeExportToken(t)}`);
                break;
            }
            case "fax": {
                const t = (practice.fax ?? "").trim();
                if (!t) break;
                const fax = docT("document.print.fax");
                lines.push(`${fax} ${privacy.fax ? isolateLtrPhone(t) : maskPracticeExportToken(t)}`);
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
                lines.push(`${docT("document.print.email")} ${privacy.email ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "kv": {
                const t = (practice.kv_number ?? "").trim();
                if (!t) break;
                lines.push(`${docT("document.print.kv_number_label")} ${privacy.kv ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "tax": {
                const ust = (practice.vat_id ?? "").trim();
                if (ust) lines.push(`${docT("document.print.vat_id_label")} ${privacy.vat ? ust : maskPracticeExportToken(ust)}`);
                const st = (practice.tax_number ?? "").trim();
                if (st) lines.push(`${docT("document.print.tax_no_label")} ${privacy.tax ? st : maskPracticeExportToken(st)}`);
                break;
            }
            case "hours": {
                const t = (practice.opening_hours ?? "").trim();
                if (!t) break;
                lines.push(`${docT("document.print.opening_hours_label")}: ${privacy.hours ? t : maskPracticeExportToken(t)}`);
                break;
            }
            case "clinician": {
                const n = (practice.clinician_name ?? "").trim();
                if (!n) break;
                const title = (practice.professional_title ?? "").trim();
                const label = title ? `${n}, ${title}` : n;
                lines.push(`${docT("document.print.clinician")}: ${privacy.clinician ? label : maskPracticeExportToken(label)}`);
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
                if (bank) lines.push(`${docT("document.print.bank_label")}: ${privacy.bank ? bank : maskPracticeExportToken(bank)}`);
                break;
            }
            case "chamber": {
                const t = (practice.chamber ?? "").trim();
                if (!t) break;
                lines.push(`${docT("document.print.chamber_label")}: ${t}`);
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
                if (days > 0) lines.push(docTp("document.print.payment_terms", { days }));
                break;
            }
            case "vat_notice": {
                const t = localizedVatNotice(practice.vat_exemption_notice);
                if (t) lines.push(t);
                break;
            }
            case "emergency_phone": {
                const t = (practice.emergency_phone ?? "").trim();
                if (!t) break;
                lines.push(`${docT("document.print.emergency_label")}: ${isolateLtrPhone(t)}`);
                break;
            }
            default:
                break;
        }
    }

    return lines;
}

/**
 * VAT notice in the document language. The default notice is stored in the
 * UI language Settings was first saved in; a stored default (any language)
 * is replaced by the document language's default, custom text stays.
 */
export function localizedVatNotice(stored: string | null | undefined): string {
    const text = (stored ?? "").trim();
    const norm = (s: string) => s.trim().replace(/\.$/, "").replace(/\s+/g, " ").toLowerCase();
    const defaults = [
        ...SUPPORTED_LOCALES.flatMap((l) => [
            translateLocale(l, "settings.practice.vat_exemption_default"),
            translateLocale(l, "document.print.vat_exempt_default"),
        ]),
        // Defaults stored by earlier versions.
        "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG",
        "Umsatzsteuerfrei gem. § 4 Nr. 14 UStG",
        "VAT exempt pursuant to § 4 No. 14 UStG",
        "VAT-exempt under § 4 No. 14 UStG",
        "Exonéré de TVA conformément au § 4 n° 14 UStG",
        "Exonéré de TVA selon § 4 n° 14 UStG",
        "معفى من ضريبة القيمة المضافة وفق § 4 رقم 14 UStG",
    ];
    if (!text || defaults.some((d) => norm(d) === norm(text))) {
        return docT("settings.practice.vat_exemption_default");
    }
    return text;
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
