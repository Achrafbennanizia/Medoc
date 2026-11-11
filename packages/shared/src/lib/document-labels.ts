/**
 * Fixed legal wording for official documents that has no UI translation key.
 * Kept here (not in the UI locale files) because it is document text with a
 * legal meaning and must not drift with UI copy changes.
 */
import { documentLocale, type DocumentLocale } from "@/lib/document-locale";

const LABELS = {
    determined_on: { de: "Festgestellt am", en: "Determined on", fr: "Constaté le", ar: "تاريخ ثبوت العجز" },
    incapable_since: { de: "Arbeitsunfähig seit", en: "Unable to work since", fr: "En incapacité depuis", ar: "غير قادر على العمل منذ" },
    expected_until: {
        de: "Voraussichtlich arbeitsunfähig bis einschließlich",
        en: "Expected to be unable to work until (incl.)",
        fr: "Incapacité prévue jusqu'au (inclus)",
        ar: "متوقع أن يستمر العجز حتى",
    },
    first_or_follow_up: {
        de: "Erst-/Folgebescheinigung",
        en: "First / follow-up certificate",
        fr: "Certificat initial / de prolongation",
        ar: "شهادة أولى / متابعة",
    },
    strength: { de: "Wirkstärke", en: "Strength", fr: "Dosage (force)", ar: "التركيز" },
    dosage_form: { de: "Darreichungsform", en: "Dosage form", fr: "Forme galénique", ar: "شكل الجرعة" },
    pack: { de: "Packungsgröße / Menge", en: "Pack size / quantity", fr: "Conditionnement / quantité", ar: "حجم العبوة / الكمية" },
    substitution: { de: "Austausch", en: "Substitution", fr: "Substitution", ar: "الاستبدال" },
    substitution_excluded: {
        de: "Austausch ausgeschlossen (aut idem)",
        en: "Substitution excluded (aut idem)",
        fr: "Substitution exclue (aut idem)",
        ar: "الاستبدال غير مسموح",
    },
    substitution_allowed: {
        de: "Austausch zulässig",
        en: "Substitution allowed",
        fr: "Substitution autorisée",
        ar: "الاستبدال مسموح",
    },
    private_rx_validity: {
        de: "Privatrezept – gültig 3 Monate ab Ausstellungsdatum. Nur mit eigenhändiger Unterschrift gültig.",
        en: "Private prescription – valid for 3 months from the date of issue. Valid only with a handwritten signature.",
        fr: "Ordonnance privée – valable 3 mois à compter de la date d'émission. Valable uniquement avec signature manuscrite.",
        ar: "وصفة خاصة — صالحة لثلاثة أشهر من تاريخ الإصدار. لا تسري إلا بتوقيع بخط اليد.",
    },
    service: { de: "Leistung", en: "Service", fr: "Prestation", ar: "الخدمة" },
    invoice_amount: { de: "Rechnungsbetrag", en: "Amount invoiced", fr: "Montant facturé", ar: "المبلغ المفوتر" },
    paid_now: { de: "Heute bezahlt", en: "Paid today", fr: "Payé aujourd'hui", ar: "المدفوع اليوم" },
    outstanding: { de: "Noch offen", en: "Outstanding", fr: "Reste à payer", ar: "المبلغ المتبقي" },
    received_amount: { de: "Erhaltener Betrag", en: "Amount received", fr: "Montant reçu", ar: "المبلغ المستلم" },
    receipt_paid_partially: {
        de: "Teilzahlung – der Restbetrag ist weiterhin offen.",
        en: "Partial payment – the remaining amount is still outstanding.",
        fr: "Paiement partiel – le solde reste dû.",
        ar: "دفعة جزئية — المبلغ المتبقي ما زال مستحقًا.",
    },
} as const satisfies Record<string, Record<DocumentLocale, string>>;

export type DocumentLabelKey = keyof typeof LABELS;

export function docLabel(key: DocumentLabelKey, locale: DocumentLocale = documentLocale()): string {
    return LABELS[key][locale];
}
