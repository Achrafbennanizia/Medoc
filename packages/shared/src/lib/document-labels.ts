/**
 * Fixed legal wording on official documents (certificates, prescriptions, receipts), translated in the
 * locale files under `document.legal.*` like every other text. Kept in its own namespace — not reused by
 * screens — so changing UI copy can never change a document's legal wording by accident.
 * Rendered in the document language (Settings → documents), which can differ from the screen language.
 */
import { documentLocale, type DocumentLocale } from "@/lib/document-locale";
import { translateLocale } from "@/lib/i18n";

export const DOCUMENT_LABEL_KEYS = [
    "determined_on",
    "incapable_since",
    "expected_until",
    "first_or_follow_up",
    "strength",
    "dosage_form",
    "pack",
    "substitution",
    "substitution_excluded",
    "substitution_allowed",
    "private_rx_validity",
    "service",
    "invoice_amount",
    "paid_now",
    "outstanding",
    "received_amount",
    "receipt_paid_partially",
] as const;

export type DocumentLabelKey = (typeof DOCUMENT_LABEL_KEYS)[number];

export function docLabel(key: DocumentLabelKey, locale: DocumentLocale = documentLocale()): string {
    return translateLocale(locale, `document.legal.${key}`);
}
