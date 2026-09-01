/**
 * Structured PDF layout payloads for the Rust renderer (`clinical_pdf_layout.rs`).
 * Matches German reference layouts (Certificate, Prescription, Patient receipt).
 */

import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import type { Patient, Treatment, Examination, Payment } from "@/models/types";
import { translateLocale, translateLocaleParams, useLocale } from "@/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { buildClinicalTemplateHeaderLines } from "@/lib/clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1, type PracticeFieldKey } from "@/lib/document-template-schema";
import { loadPracticeHeaderPrivacy } from "@/lib/practice-header-privacy";
import { formatPaymentReferenceLine, paymentStatusDisplay, paymentMethodLabel } from "@/lib/payment-booking";

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
};

function headerContactRightFromPractice(): string[] {
    const p = getInvoicePracticeFromStorage();
    const out: string[] = [];
    const tel = (p.phone ?? "").trim();
    const fax = (p.fax ?? "").trim();
    const mail = (p.email ?? "").trim();
    if (tel) out.push(`${docT("document.print.phone")}: ${tel}`);
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
    if (zanr || bsnr) out.push(`ZANR: ${zanr || "-"} / BSNR: ${bsnr || "-"}`);
    out.push("(Stamp / signature)");
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
        (a.first_or_follow_up ?? "FIRST") === "FOLLOW_UP" ? "Follow-up certificate" : "Initial certificate";
    const pname = patient?.name ?? a.patient_id;
    const dob = patient ? formatDate(patient.date_of_birth) : "—";
    const icd = (a.icd10_code ?? "").trim() || "—";

    const intro = [
        `This certifies that ${pname}${patient ? `, born on ${dob},` : ""} is under medical treatment.`,
    ];

    const labelValueRows: { label: string; value: string }[] = [
        { label: "Type of certificate", value: `${a.kind} (${firstOrFollowUp})` },
        {
            label: "Validity period",
            value: `${from} until ${until} (${days} calendar day${days === 1 ? "" : "s"})`,
        },
        { label: "Diagnosis (ICD-10)", value: icd },
    ];
    if (a.kind.toLowerCase().includes("sick_leave") && (a.employer ?? "").trim()) {
        labelValueRows.push({ label: "Employer", value: a.employer!.trim() });
    }

    const finding = a.body_text.split(/\r?\n/).map((s) => s.trimEnd()).filter((s) => s.length > 0);
    const findingText = finding.join("\n").trim();
    const labelRows = [...labelValueRows];
    if (findingText) {
        labelRows.unshift({ label: "Findings / notes", value: findingText });
    }
    labelRows.push({ label: "Place, date", value: "________________________________________" });

    return {
        kind: "certificate",
        practiceLines: practiceLinesForPdf(),
        headerRightLines: headerContactRightFromPractice(),
        metaLines: [],
        addressLines: [],
        documentTitle: "MEDICAL CERTIFICATE",
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
            { label: "Issue date", value: issued },
            { label: "Certificate-Nr.", value: a.id.slice(0, 8).toUpperCase() },
        ],
    };
}

export function buildPrescriptionPdfLayout(r: Prescription, patient: Patient | null): ClinicalPdfLayout {
    const kind = (r.prescription_type ?? "PRIVAT").trim() || "PRIVAT";
    const autIdem = r.aut_idem !== false;
    const left: string[] = [
        `Name: ${patient?.name ?? "—"}`,
        patient ? `Date of birth: ${formatDate(patient.date_of_birth)}` : "",
        patient?.insurance_number ? `Ins. no.: ${patient.insurance_number}` : "",
    ].filter(Boolean);
    const right: string[] = [
        patient?.address?.trim() ? patient.address.trim().replace(/\n/g, ", ") : "",
    ].filter(Boolean);

    return {
        kind: "prescription",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: "Prescription number", value: r.id.slice(0, 8).toUpperCase() },
            { label: "Prescription date", value: formatPrescriptionDate(r.issued_at) },
            { label: "Prescription type", value: kind },
        ],
        addressLines: [],
        documentTitle: "PRESCRIPTION",
        documentSubtitle: `Prescription (${kind})`,
        introParagraphs: [],
        twoColumn: {
            leftTitle: "Patient",
            leftLines: left,
            rightTitle: "Address",
            rightLines: right.length > 0 ? right : ["—"],
        },
        tables: [
            {
                title: "Rx — prescribed medication",
                columnLayout: "prescription",
                headers: ["Medication", "Dosage", "Duration", "PZN", "Notes"],
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
                        autIdem ? "aut idem" : "Substitution allowed",
                    ],
                ],
            },
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
    };
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
    return {
        kind: "prescription",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: "Date", value: formatPrescriptionDate(first.issued_at) },
            { label: "Line items", value: String(items.length) },
        ],
        addressLines: [],
        documentTitle: "COMBINATION PRESCRIPTION",
        documentSubtitle: `${items.length} medications`,
        introParagraphs: [],
        twoColumn: patient
            ? {
                  leftTitle: "Patient",
                  leftLines: [
                      `Name: ${patient.name}`,
                      `Date of birth: ${formatDate(patient.date_of_birth)}`,
                      patient.insurance_number ? `Ins. no.: ${patient.insurance_number}` : "",
                  ].filter(Boolean),
                  rightTitle: "Address",
                  rightLines: patient.address?.trim()
                      ? [patient.address.trim().replace(/\n/g, ", ")]
                      : ["—"],
              }
            : null,
        tables: [
            {
                title: "Rp.",
                columnLayout: "prescription_combo",
                headers: ["Pos.", "Medication", "Dosage", "Duration", "PZN"],
                rows,
            },
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
    };
}

export function buildReceiptPdfLayout(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    receiptNumber: string,
): ClinicalPdfLayout {
    const reference = receiptServiceDescription(z, treatments, examinations);
    const practice = getInvoicePracticeFromStorage();
    const ust =
        (practice.vat_exemption_notice ?? "").trim() || "VAT-exempt under § 4 No. 14 UStG";

    const payDate = formatClinicalDate(z.created_at);
    const amount = formatCurrency(z.amount);

    return {
        kind: "receipt",
        practiceLines: practiceLinesForPdf(),
        metaLines: [
            { label: "Receipt-Nr.", value: receiptNumber },
            { label: "Payment date", value: payDate },
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
        documentTitle: "PATIENT RECEIPT",
        documentSubtitle: `for ${patient.name}`,
        introParagraphs: [`Billed service items for ${payDate}`],
        labelValueRows: [
            { label: "Patient", value: patient.name },
            { label: "Date of birth", value: formatClinicalDate(patient.date_of_birth) },
            ...(patient.insurance_number
                ? [{ label: "Insurance number", value: patient.insurance_number }]
                : []),
        ],
        twoColumn: null,
        tables: [
            {
                title: null,
                columnLayout: "receipt",
                headers: ["Date", "Item", "Description"],
                rows: [[payDate, receiptNumber, reference]],
            },
        ],
        detailRecords: [],
        totals: [
            { label: "Material costs", value: formatCurrency(0) },
            { label: "Fee", value: amount },
            { label: "Total", value: amount },
        ],
        closingParagraphs: [
            `Payment method: ${paymentMethodLabel(z.payment_method, docT)} · Status: ${paymentStatusDisplay(z.status, docT).label}`,
            ust,
            ...(z.payment_method === "CASH" || z.payment_method === "CARD" ? ["Amount received with thanks."] : []),
            // Description already used as table row when no B/U link — avoid duplicating.
            ...((z.description ?? "").trim() && (z.treatment_id || z.examination_id)
                ? [(z.description ?? "").trim()]
                : []),
        ],
        signatureLines: signatureLines(),
    };
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
