/**
 * Klinische Dokument-PDFs (Attest, Rezept, Quittung): strukturierte Vorlage + fachlicher Body.
 *
 * Architektur (analog zu üblichem Document-Pattern): View/Export baut ein **Datenpaket** (Body-Zeilen),
 * diese Schicht fügt den **Briefkopf** gemäß Vorlage (`kopf.fieldsToShow`) und **Privatsphäre**
 * (Einstellungen › Praxis) zusammen — Rust rendert nur noch Zeilen, kein Roh-HTML.
 */

import type { DocumentTemplatePayloadV1, PraxisFieldKey } from "@/lib/document-template-schema";
import type { InvoicePraxis } from "@/lib/invoice-leistung";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import {
    loadPraxisHeaderPrivacy,
    maskPraxisExportToken,
    type PraxisHeaderPrivacyV1,
} from "@/lib/praxis-header-privacy";

const KOPF_ORDER: PraxisFieldKey[] = [
    "name",
    "address",
    "phone",
    "fax",
    "web",
    "email",
    "kv",
    "tax",
    "hours",
    "behandler",
    "zanr",
    "bsnr",
    "bank",
    "kammer",
    "kzv",
    "zahlungsziel",
    "ust_hinweis",
    "notfall_tel",
];

function formatWeb(p: InvoicePraxis): string {
    return (p.web ?? "").trim().replace(/^https?:\/\//i, "");
}

/** Praxis-Kopfzeilen für Template-PDF — nur gewählte Felder, mit Maskierung wie beim Rechnungs-PDF. */
export function buildClinicalTemplateKopfLines(
    payload: DocumentTemplatePayloadV1,
    praxis: InvoicePraxis,
    privacy: PraxisHeaderPrivacyV1,
): string[] {
    const want = new Set(payload.kopf.fieldsToShow);
    const lines: string[] = [];

    for (const key of KOPF_ORDER) {
        if (!want.has(key)) continue;
        switch (key) {
            case "name": {
                const n = (praxis.name ?? "").trim();
                if (n) lines.push(n);
                break;
            }
            case "address": {
                for (const raw of (praxis.addr ?? "").split(/\r?\n/)) {
                    const t = raw.trim();
                    if (t) lines.push(t);
                }
                break;
            }
            case "phone": {
                const t = (praxis.telefon ?? "").trim();
                if (!t) break;
                lines.push(`Tel. ${privacy.tel ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "fax": {
                const t = (praxis.fax ?? "").trim();
                if (!t) break;
                lines.push(`Fax ${privacy.fax ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "web": {
                const w = formatWeb(praxis);
                if (!w) break;
                lines.push(privacy.web ? w : maskPraxisExportToken(w));
                break;
            }
            case "email": {
                const t = (praxis.email ?? "").trim();
                if (!t) break;
                lines.push(`E-Mail ${privacy.email ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "kv": {
                const t = (praxis.kv_nummer ?? "").trim();
                if (!t) break;
                lines.push(`KV- / Betriebsnr. ${privacy.kv ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "tax": {
                const ust = (praxis.ust_id ?? "").trim();
                if (ust) lines.push(`USt-IdNr. ${privacy.ust ? ust : maskPraxisExportToken(ust)}`);
                const st = (praxis.steuernummer ?? "").trim();
                if (st) lines.push(`St.-Nr. ${privacy.steuer ? st : maskPraxisExportToken(st)}`);
                break;
            }
            case "hours": {
                const t = (praxis.oeffnungszeiten ?? "").trim();
                if (!t) break;
                lines.push(`Öffn.: ${privacy.oz ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "behandler": {
                const n = (praxis.behandler_name ?? "").trim();
                if (!n) break;
                const beruf = (praxis.berufsbezeichnung ?? "").trim();
                const label = beruf ? `${n}, ${beruf}` : n;
                lines.push(`Behandler: ${privacy.behandler ? label : maskPraxisExportToken(label)}`);
                break;
            }
            case "zanr": {
                const t = (praxis.zanr ?? "").trim();
                if (!t) break;
                lines.push(`ZANR: ${privacy.zanr ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "bsnr": {
                const t = (praxis.bsnr ?? "").trim();
                if (!t) break;
                lines.push(`BSNR: ${privacy.bsnr ? t : maskPraxisExportToken(t)}`);
                break;
            }
            case "bank": {
                const iban = (praxis.bankverbindung_iban ?? "").trim();
                const bic = (praxis.bankverbindung_bic ?? "").trim();
                const bank = (praxis.bankverbindung_bank ?? "").trim();
                if (!iban && !bic && !bank) break;
                const parts: string[] = [];
                if (iban) parts.push(`IBAN: ${privacy.bank ? iban : maskPraxisExportToken(iban)}`);
                if (bic) parts.push(`BIC: ${privacy.bank ? bic : maskPraxisExportToken(bic)}`);
                if (bank) parts.push(`Bank: ${privacy.bank ? bank : maskPraxisExportToken(bank)}`);
                lines.push(parts.join(" | "));
                break;
            }
            case "kammer": {
                const t = (praxis.kammer ?? "").trim();
                if (!t) break;
                lines.push(`Kammer: ${t}`);
                break;
            }
            case "kzv": {
                const t = (praxis.kzv ?? "").trim();
                if (!t) break;
                lines.push(`KZV: ${t}`);
                break;
            }
            case "zahlungsziel": {
                const days = praxis.zahlungsziel_tage ?? 14;
                if (days > 0) lines.push(`Zahlungsziel: ${days} Tage`);
                break;
            }
            case "ust_hinweis": {
                const t = (praxis.ust_befreiung_hinweis ?? "").trim();
                if (t) lines.push(t);
                break;
            }
            case "notfall_tel": {
                const t = (praxis.notfall_telefon ?? "").trim();
                if (!t) break;
                lines.push(`Notfall: ${t}`);
                break;
            }
            default:
                break;
        }
    }

    return lines;
}

/**
 * PDF-Zeilen für `preview_document_pdf`: optionale Kopfzeilen (Vorlage + Privatsphäre) + Inhalt.
 */
export function composeClinicalDocumentPdfBodyLines(payload: DocumentTemplatePayloadV1, contentLines: string[]): string[] {
    const praxis = getInvoicePraxisFromStorage();
    const privacy = loadPraxisHeaderPrivacy();
    const kopf = buildClinicalTemplateKopfLines(payload, praxis, privacy);
    if (kopf.length === 0) return [...contentLines];
    return [...kopf, "", ...contentLines];
}
