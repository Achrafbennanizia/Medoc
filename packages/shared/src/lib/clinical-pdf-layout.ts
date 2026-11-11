/**
 * Structured PDF layout payloads for the Rust renderer (`pdf/clinical_layout.rs`).
 *
 * The frontend builds the **content** only. When a document is issued
 * (`issue_clinical_document`) the server replaces practice identity,
 * signature, footer and language from the database, allocates the document
 * number and stores the payload + SHA-256. Rows marked `confidential` are
 * removed from third-party copies (AU employer copy).
 */

import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import type {
    Patient,
    Treatment,
    Examination,
    Payment,
    TreatmentCatalogItem,
    ServiceItem,
} from "@/models/types";
import { translateLocale, translateLocaleParams, translatePluralUnit } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { formatPaymentReferenceLine, paymentMethodLabel } from "@/lib/payment-booking";
import { resolveCatalogIdForTreatment } from "@/lib/patient-detail-utils";
import { certificateKindSelectOptions } from "@/lib/certificate-composer";
import { documentLocale, documentLocaleForI18n } from "@/lib/document-locale";
import { docLabel } from "@/lib/document-labels";

/** Document text follows the document language (Settings), not the UI language. */
const docT = (key: string) => translateLocale(documentLocaleForI18n(), key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(documentLocaleForI18n(), key, params);

export type PdfLabelValue = {
    label: string;
    value: string;
    /** Medical content (diagnosis, ICD-10, findings) — removed from third-party copies. */
    confidential?: boolean;
    /** Grand-total row. */
    total?: boolean;
};

export type ClinicalPdfLayout = {
    kind: string;
    /** Overwritten by the server from the practice master data. */
    practiceLines: string[];
    headerRightLines?: string[];
    metaLines: PdfLabelValue[];
    addressLines: string[];
    documentTitle: string;
    documentSubtitle?: string | null;
    introParagraphs: string[];
    labelValueRows?: PdfLabelValue[];
    twoColumn?: {
        leftTitle?: string | null;
        leftLines: string[];
        rightTitle?: string | null;
        rightLines: string[];
    } | null;
    tables: {
        title?: string | null;
        headers: string[];
        rows: string[][];
        /** Rust column widths: `receipt` | `prescription` | `prescription_combo` */
        columnLayout?: string | null;
    }[];
    detailRecords: { kind: string; period: string; details: string[] }[];
    totals: PdfLabelValue[];
    closingParagraphs: string[];
    /** Overwritten by the server (clinician, title, ZANR/BSNR). */
    signatureLines: string[];
    footerMetaLines?: PdfLabelValue[];
    /** Set by the server: document language, number, copy variant, footer. */
    locale?: string;
    rtl?: boolean;
    copyVariant?: "patient" | "employer" | "insurer";
    documentNumber?: string;
    footerLines?: string[];
};

function base(kind: string): Pick<ClinicalPdfLayout, "kind" | "practiceLines" | "signatureLines" | "locale" | "rtl"> {
    // Practice lines are a placeholder for the on-screen preview only; the
    // server replaces them with the master data from the database.
    const p = getInvoicePracticeFromStorage();
    return {
        kind,
        practiceLines: [p.name ?? "", ...(p.addr ?? "").split(/\r?\n/)].map((l) => l.trim()).filter(Boolean),
        signatureLines: [],
        locale: documentLocale(),
        rtl: documentLocale() === "ar",
    };
}

function formatPrescriptionDate(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

function certificateKindLabel(kind: string): string {
    return certificateKindSelectOptions(docT).find((o) => o.value === kind)?.label ?? kind;
}

export function buildCertificatePdfLayout(a: Certificate, patient: Patient | null): ClinicalPdfLayout {
    const from = formatClinicalDate(a.valid_from);
    const until = formatClinicalDate(a.valid_until);
    const issued = formatClinicalDate(a.issued_at);
    const t0 = new Date(`${a.valid_from.slice(0, 10)}T12:00:00`);
    const t1 = new Date(`${a.valid_until.slice(0, 10)}T12:00:00`);
    const days = Math.max(1, Math.round((t1.getTime() - t0.getTime()) / 86_400_000) + 1);
    const followUp = (a.first_or_follow_up ?? "FIRST") === "FOLLOW_UP";
    const pname = patient?.name ?? a.patient_id;
    const dob = patient ? formatClinicalDate(patient.date_of_birth) : docT("common.em_dash");
    const icd = (a.icd10_code ?? "").trim();
    const sickLeave = a.kind === "SICK_LEAVE";

    const intro = [
        docTp("document.print.certificate_body", {
            name: pname,
            dobPart: patient ? docTp("document.print.certificate_dob_part", { dob }) : "",
        }),
    ];

    const dayUnit = translatePluralUnit(documentLocaleForI18n(), "document.print.day_unit", days);
    const rows: PdfLabelValue[] = [
        { label: docT("document.print.type_of_certificate"), value: certificateKindLabel(a.kind) },
        {
            label: docLabel("first_or_follow_up"),
            value: followUp ? docT("document.print.certificate_followup") : docT("document.print.certificate_first"),
        },
        // AU-Richtlinie: date on which the incapacity was determined.
        { label: docLabel("determined_on"), value: issued },
    ];
    if (sickLeave) {
        rows.push(
            { label: docLabel("incapable_since"), value: from },
            { label: docLabel("expected_until"), value: `${until} (${days} ${dayUnit})` },
        );
        if ((a.employer ?? "").trim()) {
            rows.push({ label: docT("document.print.employer_label"), value: a.employer!.trim() });
        }
    } else {
        rows.push({
            label: docT("document.print.validity_period_label"),
            value: `${from} – ${until} (${days} ${dayUnit})`,
        });
    }
    if (icd) {
        rows.push({ label: docT("document.print.diagnosis_icd_label"), value: icd, confidential: true });
    }
    const findingText = a.body_text
        .split(/\r?\n/)
        .map((s) => s.trimEnd())
        .filter((s) => s.length > 0)
        .join("\n")
        .trim();
    if (findingText) {
        rows.push({ label: docT("document.print.findings_label"), value: findingText, confidential: true });
    }

    return {
        ...base("certificate"),
        metaLines: [{ label: docT("document.print.issue_date_label"), value: issued }],
        addressLines: [],
        documentTitle: sickLeave
            ? docT("enum.certificate_kind.sick_leave_certificate").toUpperCase()
            : docT("document.print.medical_certificate"),
        documentSubtitle: null,
        introParagraphs: intro,
        labelValueRows: rows,
        twoColumn: null,
        tables: [],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        footerMetaLines: [],
    };
}

function patientPanel(patient: Patient | null): ClinicalPdfLayout["twoColumn"] {
    const left: string[] = [
        docTp("document.print.name_line", { name: patient?.name ?? docT("common.em_dash") }),
        patient ? `${docT("document.print.date_of_birth")}: ${formatClinicalDate(patient.date_of_birth)}` : "",
        patient?.insurance_number ? docTp("document.print.ins_no_short", { number: patient.insurance_number }) : "",
    ].filter(Boolean);
    const right = patient?.address?.trim() ? [patient.address.trim().replace(/\n/g, ", ")] : [docT("common.em_dash")];
    return {
        leftTitle: docT("document.print.patient"),
        leftLines: left,
        rightTitle: docT("document.print.address_label"),
        rightLines: right,
    };
}

function substitutionText(r: Prescription): string {
    // `aut_idem = true` in MeDoc means "substitution excluded" (box crossed).
    return r.aut_idem ? docLabel("substitution_excluded") : docLabel("substitution_allowed");
}

/** AMVV § 2: drug incl. strength, dosage form, dosage, prescriber signature. */
export function buildPrescriptionPdfLayout(r: Prescription, patient: Patient | null): ClinicalPdfLayout {
    const kind = (r.prescription_type ?? "PRIVAT").trim() || "PRIVAT";
    return {
        ...base("prescription"),
        metaLines: [
            { label: docT("document.print.prescription_date_label"), value: formatPrescriptionDate(r.issued_at) },
            { label: docT("document.print.prescription_type_label"), value: kind },
        ],
        addressLines: [],
        documentTitle: docT("document.print.prescription_title").toUpperCase(),
        documentSubtitle: docTp("document.print.prescription_heading", { type: kind }),
        introParagraphs: [],
        twoColumn: patientPanel(patient),
        tables: [
            {
                title: "Rp.",
                columnLayout: "prescription",
                headers: [
                    `${docT("document.print.medication")} / ${docLabel("strength")}`,
                    docLabel("dosage_form"),
                    docT("document.print.dosage"),
                    docT("document.print.pzn_col"),
                ],
                rows: [
                    [
                        r.medication,
                        (r.dosage_form ?? "").trim() || "—",
                        r.dosage,
                        (r.pzn ?? "").trim() || "—",
                    ],
                ],
            },
        ],
        labelValueRows: [
            ...((r.active_ingredient ?? "").trim()
                ? [{ label: docT("document.print.active_ingredient"), value: r.active_ingredient!.trim() }]
                : []),
            { label: docT("document.print.duration"), value: r.duration },
            { label: docLabel("substitution"), value: substitutionText(r) },
            ...((r.instructions ?? "").trim()
                ? [{ label: docT("document.print.notes"), value: r.instructions!.trim() }]
                : []),
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: kind === "PRIVAT" ? [docLabel("private_rx_validity")] : [],
    };
}

export function buildPrescriptionComboPdfLayout(items: Prescription[], patient: Patient | null): ClinicalPdfLayout {
    const first = items[0]!;
    const rows = items.map((r, i) => [
        String(i + 1),
        r.medication,
        (r.dosage_form ?? "").trim() || "—",
        r.dosage,
        (r.pzn ?? "").trim() || "—",
    ]);
    const notes = items
        .map((r, i) => {
            const parts = [`${r.duration}`, substitutionText(r), (r.instructions ?? "").trim()].filter(Boolean);
            return `${i + 1}. ${parts.join(" · ")}`;
        });
    const allPrivate = items.every((r) => (r.prescription_type ?? "PRIVAT") === "PRIVAT");
    return {
        ...base("prescription"),
        metaLines: [
            { label: docT("document.print.date"), value: formatPrescriptionDate(first.issued_at) },
            { label: docT("document.print.line_items"), value: String(items.length) },
        ],
        addressLines: [],
        documentTitle: docTp("document.print.combo_heading", { count: items.length }),
        documentSubtitle: docTp("document.print.prescription_combo_title", { count: items.length }),
        introParagraphs: [],
        twoColumn: patientPanel(patient),
        tables: [
            {
                title: "Rp.",
                columnLayout: "prescription_combo",
                headers: [
                    docT("document.print.item"),
                    `${docT("document.print.medication")} / ${docLabel("strength")}`,
                    docLabel("dosage_form"),
                    docT("document.print.dosage"),
                    docT("document.print.pzn_col"),
                ],
                rows,
            },
        ],
        labelValueRows: [{ label: docT("document.print.notes"), value: notes.join("\n") }],
        detailRecords: [],
        totals: [],
        closingParagraphs: allPrivate ? [docLabel("private_rx_validity")] : [],
    };
}

/** Prices shown on the patient receipt: catalog standard, charged line, amount paid. */
export type ReceiptPriceBreakdown = {
    standardPrice: number | null;
    billedPrice: number | null;
    paidPrice: number;
};

export function receiptPriceBreakdown(
    z: Payment,
    treatments: Treatment[],
    examinations: Examination[],
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): ReceiptPriceBreakdown {
    const paidPrice = z.amount;
    let billedPrice: number | null = null;
    let serviceName = "";

    if (z.treatment_id) {
        const b = treatments.find((t) => t.id === z.treatment_id);
        if (b) {
            serviceName = (b.service_name || b.description || b.kind || "").trim();
            if (b.total_cost != null && Number.isFinite(b.total_cost)) {
                billedPrice = b.total_cost;
            }
        }
    } else if (z.examination_id) {
        const u = examinations.find((e) => e.id === z.examination_id);
        if (u) {
            serviceName = (u.service_name || "").trim();
            if (u.total_cost != null && Number.isFinite(u.total_cost)) {
                billedPrice = u.total_cost;
            }
        }
    }

    if (
        billedPrice == null
        && z.amount_expected != null
        && Number.isFinite(z.amount_expected)
        && z.amount_expected > 0
    ) {
        billedPrice = z.amount_expected;
    }

    let standardPrice: number | null = null;
    if (z.service_item_id) {
        const si = services.find((s) => s.id === z.service_item_id);
        if (si && Number.isFinite(si.price)) {
            standardPrice = si.price;
        }
    }
    if (standardPrice == null && z.treatment_id) {
        const b = treatments.find((t) => t.id === z.treatment_id);
        if (b) {
            const catId = resolveCatalogIdForTreatment(catalog, b);
            const cat = catalog.find((k) => k.id === catId);
            if (cat?.default_cost != null && Number.isFinite(cat.default_cost)) {
                standardPrice = cat.default_cost;
            }
        }
    }
    if (standardPrice == null && serviceName) {
        const exact = catalog.find((k) => k.active !== 0 && k.name === serviceName);
        const fuzzy =
            exact
            ?? catalog.find(
                (k) =>
                    k.active !== 0
                    && (serviceName.includes(k.name) || k.name.includes(serviceName)),
            );
        if (fuzzy?.default_cost != null && Number.isFinite(fuzzy.default_cost)) {
            standardPrice = fuzzy.default_cost;
        }
    }

    return { standardPrice, billedPrice, paidPrice };
}

/**
 * Payment receipt. The patient has already paid, so this document confirms
 * the amount received. It does not ask for payment, show a due date, or
 * reuse the invoice fee table. The server still allocates the QU number.
 */
export function buildReceiptPdfLayout(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): ClinicalPdfLayout {
    const practice = getInvoicePracticeFromStorage();
    const ust =
        (practice.vat_exemption_notice ?? "").trim() ||
        translateLocale(documentLocaleForI18n(), "settings.practice.vat_exemption_default");
    const payDate = formatClinicalDate(z.created_at);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const treatment = z.treatment_id ? treatments.find((t) => t.id === z.treatment_id) : undefined;
    const serviceDate = formatClinicalDate(treatment?.treatment_date || treatment?.created_at || z.created_at);
    const loc = documentLocale();
    const description = receiptServiceDescription(z, treatments, examinations);

    const metaLines: PdfLabelValue[] = [
        { label: docT("document.print.payment_date"), value: payDate },
        { label: docT("document.print.payment_method"), value: paymentMethodLabel(z.payment_method, docT) },
    ];

    return {
        ...base("receipt"),
        metaLines,
        addressLines: [
            patient.name,
            ...(patient.address?.trim()
                ? patient.address
                      .trim()
                      .split(/\n+/)
                      .map((l) => l.trim())
                      .filter(Boolean)
                : []),
        ],
        documentTitle: docT("document.print.receipt_title"),
        documentSubtitle: null,
        introParagraphs: [],
        labelValueRows: [],
        twoColumn: null,
        tables: [
            {
                title: null,
                columnLayout: "receipt",
                headers: [
                    docT("document.print.date"),
                    docT("document.print.col_service"),
                    docT("document.print.amount_paid"),
                ],
                rows: [[serviceDate || payDate, description, receiptMoney(prices.paidPrice, loc)]],
            },
        ],
        detailRecords: [],
        totals: [
            { label: docLabel("received_amount"), value: receiptMoney(prices.paidPrice, loc), total: true },
        ],
        closingParagraphs: [ust, docT("document.print.amount_received")].filter((line) => line.trim().length > 0),
    };
}

function receiptMoney(amount: number, locale: string): string {
    const tag = locale === "en" ? "en-GB" : "de-DE";
    return new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/** DD.MM.YYYY for clinical printouts (independent of UI locale). */
function formatClinicalDate(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-" && d[7] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

/** Patient-facing service line — never show internal “No B/U line” jargon. */
function receiptServiceDescription(
    z: Payment,
    treatments: Treatment[],
    examinations: Examination[],
): string {
    if (z.treatment_id || z.examination_id) {
        return formatPaymentReferenceLine(z, treatments, examinations, docT, docTp);
    }
    const desc = (z.description ?? "").trim();
    if (desc) return desc;
    return docT("enum.reference.direct_payment");
}
