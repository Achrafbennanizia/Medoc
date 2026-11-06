/**
 * Structured PDF layout payloads for the Rust renderer (`clinical_pdf_layout.rs`).
 * Matches German reference layouts (Certificate, Prescription, Patient receipt).
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
import { translateLocale, translateLocaleParams, useLocale } from "@/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { buildClinicalTemplateHeaderLines } from "@/lib/clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1, type PracticeFieldKey } from "@/lib/document-template-schema";
import { loadPracticeHeaderPrivacy } from "@/lib/practice-header-privacy";
import { isolateLtrPhone } from "@/lib/arabic-numerals";
import { formatPaymentReferenceLine, paymentStatusDisplay, paymentMethodLabel } from "@/lib/payment-booking";
import { resolveCatalogIdForTreatment } from "@/lib/patient-detail-utils";

const docT = (key: string) => translateLocale(useLocale.getState().locale, key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(useLocale.getState().locale, key, params);

const HEADER_FIELDS: PracticeFieldKey[] = [
    "name",
    "address",
    "phone",
    "email",
    "clinician",
    "zanr",
    "bsnr",
    "bank",
];

export type ClinicalPdfLayout = {
    kind: string;
    practiceLines: string[];
    /** Contact lines top right (Certificate reference layout). */
    headerRightLines?: string[];
    metaLines: { label: string; value: string }[];
    addressLines: string[];
    documentTitle: string;
    documentSubtitle?: string | null;
    introParagraphs: string[];
    /** Two-line principle: label (line 1) + value (line 2). */
    labelValueRows?: { label: string; value: string }[];
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
    totals: { label: string; value: string }[];
    closingParagraphs: string[];
    signatureLines: string[];
    /** Meta bottom-right (Certificate: issue date, number). */
    footerMetaLines?: { label: string; value: string }[];
    /** UI locale for chrome (`en`|`de`|`fr`|`ar`). */
    locale?: string;
    /** Arabic: practice logo top-right. */
    rtl?: boolean;
};

function withDocumentLocale<T extends ClinicalPdfLayout>(layout: T): T {
    const locale = useLocale.getState().locale;
    return {
        ...layout,
        locale,
        rtl: locale === "ar",
    };
}

function headerContactRightFromPractice(): string[] {
    const p = getInvoicePracticeFromStorage();
    const out: string[] = [];
    const tel = (p.phone ?? "").trim();
    const fax = (p.fax ?? "").trim();
    const mail = (p.email ?? "").trim();
    if (tel) out.push(`${docT("document.print.phone")}: ${isolateLtrPhone(tel)}`);
    if (fax) out.push(`${docT("document.print.fax")}: ${fax}`);
    if (mail) out.push(`${docT("document.print.email")}: ${mail}`);
    return out;
}

function practiceLinesForPdf(): string[] {
    const practice = getInvoicePracticeFromStorage();
    const tpl = emptyDocumentTemplatePayloadV1();
    tpl.header.fieldsToShow = HEADER_FIELDS;
    return buildClinicalTemplateHeaderLines(tpl, practice, loadPracticeHeaderPrivacy());
}

function formatPrescriptionDate(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

function signatureLines(): string[] {
    const p = getInvoicePracticeFromStorage();
    const bh = (p.clinician_name ?? "").trim();
    const professionalTitle = (p.professional_title ?? "").trim();
    const zanr = (p.zanr ?? "").trim();
    const bsnr = (p.bsnr ?? "").trim();
    if (!bh) return [];
    const out = [bh];
    if (professionalTitle) out.push(professionalTitle);
    if (zanr || bsnr) out.push(docTp("document.print.zanr_bsnr", { zanr: zanr || "-", bsnr: bsnr || "-" }));
    out.push(docT("document.print.stamp_signature"));
    return out;
}

export function buildCertificatePdfLayout(a: Certificate, patient: Patient | null): ClinicalPdfLayout {
    const from = formatDate(a.valid_from);
    const until = formatDate(a.valid_until);
    const issued = formatDate(a.issued_at);
    const t0 = new Date(`${a.valid_from.slice(0, 10)}T12:00:00`);
    const t1 = new Date(`${a.valid_until.slice(0, 10)}T12:00:00`);
    const days = Math.max(1, Math.round((t1.getTime() - t0.getTime()) / 86_400_000) + 1);
    const firstOrFollowUp =
        (a.first_or_follow_up ?? "FIRST") === "FOLLOW_UP"
            ? docT("document.print.certificate_followup")
            : docT("document.print.certificate_first");
    const pname = patient?.name ?? a.patient_id;
    const dob = patient ? formatDate(patient.date_of_birth) : docT("common.em_dash");
    const icd = (a.icd10_code ?? "").trim() || docT("common.em_dash");

    const intro = [
        docTp("document.print.certificate_body", {
            name: pname,
            dobPart: patient ? docTp("document.print.certificate_dob_part", { dob }) : "",
        }),
    ];

    const labelValueRows: { label: string; value: string }[] = [
        { label: docT("document.print.type_of_certificate"), value: `${a.kind} (${firstOrFollowUp})` },
        {
            label: docT("document.print.validity_period_label"),
            value: `${from} – ${until} (${days})`,
        },
        { label: docT("document.print.diagnosis_icd_label"), value: icd },
    ];
    if (a.kind.toLowerCase().includes("sick_leave") && (a.employer ?? "").trim()) {
        labelValueRows.push({ label: docT("document.print.employer_label"), value: a.employer!.trim() });
    }

    const finding = a.body_text.split(/\r?\n/).map((s) => s.trimEnd()).filter((s) => s.length > 0);
    const findingText = finding.join("\n").trim();
    const labelRows = [...labelValueRows];
    if (findingText) {
        labelRows.unshift({ label: docT("document.print.findings_label"), value: findingText });
    }
    labelRows.push({ label: docT("document.print.place_date_label"), value: "________________________________________" });

    return withDocumentLocale({
        kind: "certificate",
        practiceLines: practiceLinesForPdf(),
        headerRightLines: headerContactRightFromPractice(),
        metaLines: [],
        addressLines: [],
        documentTitle: docT("document.print.medical_certificate"),
        documentSubtitle: null,
        introParagraphs: intro,
        labelValueRows: labelRows,
        twoColumn: null,
        tables: [],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
        footerMetaLines: [
            { label: docT("document.print.issue_date_label"), value: issued },
            { label: docT("document.print.certificate_nr_label"), value: a.id.slice(0, 8).toUpperCase() },
        ],
    });
}

export function buildPrescriptionPdfLayout(r: Prescription, patient: Patient | null): ClinicalPdfLayout {
    const kind = (r.prescription_type ?? "PRIVAT").trim() || "PRIVAT";
    const autIdem = r.aut_idem !== false;
    const left: string[] = [
        docTp("document.print.name_line", { name: patient?.name ?? docT("common.em_dash") }),
        patient ? `${docT("document.print.date_of_birth")}: ${formatDate(patient.date_of_birth)}` : "",
        patient?.insurance_number ? docTp("document.print.ins_no_short", { number: patient.insurance_number }) : "",
    ].filter(Boolean);
    const right: string[] = [
        patient?.address?.trim() ? patient.address.trim().replace(/\n/g, ", ") : "",
    ].filter(Boolean);

    return withDocumentLocale({
        kind: "prescription",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: docT("document.print.prescription_number_label"), value: r.id.slice(0, 8).toUpperCase() },
            { label: docT("document.print.prescription_date_label"), value: formatPrescriptionDate(r.issued_at) },
            { label: docT("document.print.prescription_type_label"), value: kind },
        ],
        addressLines: [],
        documentTitle: docT("document.print.prescription_title").toUpperCase(),
        documentSubtitle: docTp("document.print.prescription_heading", { type: kind }),
        introParagraphs: [],
        twoColumn: {
            leftTitle: docT("document.print.patient"),
            leftLines: left,
            rightTitle: docT("document.print.address_label"),
            rightLines: right.length > 0 ? right : [docT("common.em_dash")],
        },
        tables: [
            {
                title: docT("document.print.rx_table_title"),
                columnLayout: "prescription",
                headers: [
                    docT("document.print.medication"),
                    docT("document.print.dosage"),
                    docT("document.print.duration"),
                    docT("document.print.pzn_col"),
                    docT("document.print.notes"),
                ],
                rows: [
                    [
                        r.medication,
                        r.dosage,
                        r.duration,
                        (r.pzn ?? "").trim() || "—",
                        (r.instructions ?? "").trim() || "—",
                    ],
                    [
                        (r.active_ingredient ?? "").trim() || "—",
                        (r.dosage_form ?? "").trim() || "—",
                        (r.pack_size ?? "").trim() || "—",
                        r.quantity != null ? String(r.quantity) : "—",
                        autIdem ? docT("document.print.aut_idem") : docT("document.print.substitution_allowed"),
                    ],
                ],
            },
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
    });
}

export function buildPrescriptionComboPdfLayout(items: Prescription[], patient: Patient | null): ClinicalPdfLayout {
    const first = items[0]!;
    const rows = items.map((r, i) => [
        String(i + 1),
        r.medication,
        r.dosage,
        r.duration,
        (r.pzn ?? "").trim() || "—",
    ]);
    return withDocumentLocale({
        kind: "prescription",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: docT("document.print.date"), value: formatPrescriptionDate(first.issued_at) },
            { label: docT("document.print.line_items"), value: String(items.length) },
        ],
        addressLines: [],
        documentTitle: docTp("document.print.combo_heading", { count: items.length }),
        documentSubtitle: docTp("document.print.prescription_combo_title", { count: items.length }),
        introParagraphs: [],
        twoColumn: patient
            ? {
                  leftTitle: docT("document.print.patient"),
                  leftLines: [
                      `${docT("document.print.patient")}: ${patient.name}`,
                      `${docT("document.print.date_of_birth")}: ${formatDate(patient.date_of_birth)}`,
                      patient.insurance_number
                          ? docTp("document.print.insurance_no", { number: patient.insurance_number })
                          : "",
                  ].filter(Boolean),
                  rightTitle: docT("document.print.address_label"),
                  rightLines: patient.address?.trim()
                      ? [patient.address.trim().replace(/\n/g, ", ")]
                      : [docT("common.em_dash")],
              }
            : null,
        tables: [
            {
                title: "Rp.",
                columnLayout: "prescription_combo",
                headers: [
                    docT("document.print.item"),
                    docT("document.print.medication"),
                    docT("document.print.dosage"),
                    docT("document.print.duration"),
                    docT("document.print.pzn_col"),
                ],
                rows,
            },
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
    });
}

/** Prices shown on the patient receipt: catalog standard, charged line, amount paid. */
export type ReceiptPriceBreakdown = {
    standardPrice: number | null;
    billedPrice: number | null;
    paidPrice: number;
};

function moneyOrDash(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "—";
    return formatCurrency(n);
}

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

export function buildReceiptPdfLayout(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    receiptNumber: string,
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): ClinicalPdfLayout {
    const reference = receiptServiceDescription(z, treatments, examinations);
    const practice = getInvoicePracticeFromStorage();
    const loc = useLocale.getState().locale;
    const ust =
        (practice.vat_exemption_notice ?? "").trim() ||
        translateLocale(loc, "settings.practice.vat_exemption_default");

    const payDate = formatClinicalDate(z.created_at);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const paid = formatCurrency(prices.paidPrice);

    return withDocumentLocale({
        kind: "receipt",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: docT("document.print.receipt_nr_label"), value: receiptNumber },
            { label: docT("document.print.payment_date"), value: payDate },
        ],
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
        documentTitle: docT("document.print.receipt_heading"),
        documentSubtitle: docTp("document.print.receipt_for", { name: patient.name }),
        introParagraphs: [docTp("document.print.billed_items_for", { date: payDate })],
        labelValueRows: [
            { label: docT("document.print.patient"), value: patient.name },
            { label: docT("document.print.date_of_birth"), value: formatClinicalDate(patient.date_of_birth) },
            ...(patient.insurance_number
                ? [{ label: docT("document.print.insurance_number_label"), value: patient.insurance_number }]
                : []),
        ],
        twoColumn: null,
        tables: [
            {
                title: null,
                columnLayout: "receipt",
                headers: [docT("document.print.date"), docT("document.print.item"), docT("document.print.description")],
                rows: [[payDate, receiptNumber, reference]],
            },
        ],
        detailRecords: [],
        totals: [
            { label: docT("document.print.standard_price"), value: moneyOrDash(prices.standardPrice) },
            { label: docT("document.print.price"), value: moneyOrDash(prices.billedPrice) },
            { label: docT("document.print.amount_paid"), value: paid },
            { label: docT("document.print.total"), value: paid },
        ],
        closingParagraphs: [
            docTp("document.print.payment_method_status", {
                method: paymentMethodLabel(z.payment_method, docT),
                status: paymentStatusDisplay(z.status, docT).label,
            }),
            ust,
            ...(z.payment_method === "CASH" || z.payment_method === "CARD"
                ? [docT("document.print.amount_received")]
                : []),
            // Description already used as table row when no B/U link — avoid duplicating.
            ...((z.description ?? "").trim() && (z.treatment_id || z.examination_id)
                ? [(z.description ?? "").trim()]
                : []),
        ],
        signatureLines: signatureLines(),
    });
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
