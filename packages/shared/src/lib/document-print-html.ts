import { translatePluralUnit } from "@/lib/i18n";
import { documentLocaleForI18n } from "@/lib/document-locale";
import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { escapeHtml, formatDate, formatCurrency, formatWrittenDay, inclusiveCalendarDays } from "@/lib/utils";
import { practiceCurrency } from "@/lib/practice-currency";
import { csvCell } from "@/lib/export-delimited";
import type {
    Patient,
    Treatment,
    Examination,
    Payment,
    TreatmentCatalogItem,
    ServiceItem,
} from "@/models/types";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { buildClinicalTemplateHeaderLines } from "@/lib/clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1, type PracticeFieldKey } from "@/lib/document-template-schema";
import { practiceCountry } from "@/lib/document-header-layout";
import { loadPracticeHeaderPrivacy } from "@/lib/practice-header-privacy";
import { formatPaymentReferenceLine } from "@/lib/payment-booking";
import { paymentMethodLabel, paymentStatusDisplay } from "@/lib/finance-order-labels";
import type { ClinicalDocumentSource } from "@/systems/practice-host/controllers/document.controller";
import {
    buildCertificatePdfLayout,
    buildReceiptPdfLayout,
    buildPrescriptionComboPdfLayout,
    buildPrescriptionPdfLayout,
    receiptPriceBreakdown,
    type ClinicalPdfLayout,
} from "@/lib/clinical-pdf-layout";
import { docT, docTp } from "./document-translate";
import { prescriptionTypeLabel } from "./prescription-type-label";

function csvRow(cells: string[]): string {
    return cells.map((c) => csvCell(c, ";")).join(";");
}

/**
 * Minimal header for exports: who the practice is and how to reach it. Practitioner numbers
 * appear once, under the signature, and only on prescriptions and certificates; no bank,
 * chamber or tax lines (same rules as the server PDFs, practice_profile.rs).
 */
const EXPORT_HEADER_FIELDS: PracticeFieldKey[] = ["name", "address", "phone", "email"];

function practiceHeaderLinesForExport(): string[] {
    const practice = getInvoicePracticeFromStorage();
    const tpl = emptyDocumentTemplatePayloadV1();
    tpl.header.fieldsToShow = EXPORT_HEADER_FIELDS;
    return buildClinicalTemplateHeaderLines(tpl, practice, loadPracticeHeaderPrivacy());
}

/** Practitioner id required on a prescription or certificate in the practice's country. */
function practitionerIdLines(): string[] {
    const p = getInvoicePracticeFromStorage();
    const v = (x: string | undefined) => (x ?? "").trim();
    switch (practiceCountry(p)) {
        case "DE":
            return [v(p.zanr) && `ZANR: ${v(p.zanr)}`, v(p.bsnr) && `BSNR: ${v(p.bsnr)}`].filter(Boolean);
        case "MA":
            return v(p.ma_inpe) ? [`INPE: ${v(p.ma_inpe)}`] : [];
        case "FR":
            return v(p.fr_rpps) ? [`RPPS: ${v(p.fr_rpps)}`] : [];
        default:
            return [];
    }
}

/** `withIds`: prescriptions and certificates carry the practitioner id; receipts do not. */
function clinicianSignatureBlock(withIds = true): string[] {
    const p = getInvoicePracticeFromStorage();
    const bh = (p.clinician_name ?? "").trim();
    const professionalTitle = (p.professional_title ?? "").trim();
    if (!bh) return [];
    const lines = ["", "____________________________", bh];
    if (professionalTitle) lines.push(professionalTitle);
    if (withIds) lines.push(...practitionerIdLines());
    lines.push(docT("document.print.stamp"));
    return lines;
}

/** Data package for clinical document export (PDF/CSV/JSON/XML). */
export type ClinicalDocumentExportBundle = {
    /** Record the official PDF is issued for (server allocates number, stores hash). */
    source: ClinicalDocumentSource;
    /** Lines for PDF renderer (`preview_document_pdf`). */
    pdfBodyLines: string[];
    /** Structured layout (Rust); preferred over `pdfBodyLines`. */
    pdfLayout: ClinicalPdfLayout;
    csvText: string;
    jsonText: string;
    xmlText: string;
};

export * from "./document-export-names";

function certificatePdfLines(a: Certificate, patient: Patient | null): string[] {
    const from = formatDate(a.valid_from);
    const until = formatDate(a.valid_until);
    const issued = formatDate(a.issued_at);
    const days = inclusiveCalendarDays(a.valid_from, a.valid_until);
    const firstOrFollowUp =
        (a.first_or_follow_up ?? "FIRST") === "FOLLOW_UP"
            ? docT("document.print.certificate_followup")
            : docT("document.print.certificate_first");
    const pname = patient?.name ?? a.patient_id;
    const dob = patient ? formatDate(patient.date_of_birth) : "—";
    const icd = (a.icd10_code ?? "").trim() || "—";
    const dobPart = patient ? docTp("document.print.certificate_dob_part", { dob }) : "";
    const unit = translatePluralUnit(documentLocaleForI18n(), "document.print.day_unit", days);
    const lines: string[] = [
        ...practiceHeaderLinesForExport(),
        "",
        docT("document.print.medical_certificate"),
        docTp("document.print.certificate_type", { kind: a.kind, issue: firstOrFollowUp }),
        "",
        docTp("document.print.certificate_body", { name: pname, dobPart }),
        "",
        docTp("document.print.validity_period", { from: from, to: until, days, unit }),
        docTp("document.print.issue_date", { date: issued }),
    ];
    if (a.kind.includes("SICK_LEAVE") && (a.employer ?? "").trim()) {
        lines.push(docTp("document.print.employer", { name: a.employer!.trim() }));
    }
    lines.push(
        docTp("document.print.diagnosis_icd", { code: icd }),
        "",
        docT("document.print.findings"),
        ...a.body_text.split(/\r?\n/).map((s) => s.trimEnd()),
        "",
        docT("document.print.place_date"),
        ...clinicianSignatureBlock(),
    );
    return lines.map((s) => s.trimEnd());
}

export function bundleCertificateExport(a: Certificate, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildCertificatePdfLayout(a, patient);
    const pdfBodyLines = certificatePdfLines(a, patient);
    const dob = patient ? formatDate(patient.date_of_birth) : "";
    const csvText =
        `${csvRow(["Type", "PatientId", "PatientName", "DateOfBirth", "ValidFrom", "ValidTo", "Issued", "ICD10", "FirstOrFollowUp", "Employer", "Content"])}\n`
        + `${csvRow([
            a.kind,
            a.patient_id,
            patient?.name ?? "",
            dob,
            formatDate(a.valid_from),
            formatDate(a.valid_until),
            formatDate(a.issued_at),
            (a.icd10_code ?? "").trim(),
            a.first_or_follow_up ?? "",
            (a.employer ?? "").trim(),
            a.body_text,
        ])}\n`;
    const jsonObj = {
        documentKind: "certificate",
        certificate: {
            id: a.id,
            patient_id: a.patient_id,
            kind: a.kind,
            body_text: a.body_text,
            valid_from: a.valid_from,
            valid_until: a.valid_until,
            issued_at: a.issued_at,
            icd10_code: a.icd10_code,
            first_or_follow_up: a.first_or_follow_up,
            employer: a.employer,
        },
        patient: patient
            ? { id: patient.id, name: patient.name, date_of_birth: patient.date_of_birth }
            : null,
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const px = patient ? `<patient id="${escapeHtml(patient.id)}" name="${escapeHtml(patient.name)}" dob="${escapeHtml(patient.date_of_birth)}"/>` : "";
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<certificateExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  ${px}\n`
        + `  <certificate id="${escapeHtml(a.id)}" kind="${escapeHtml(a.kind)}">\n`
        + `    <validFrom>${escapeHtml(formatDate(a.valid_from))}</validFrom>\n`
        + `    <validUntil>${escapeHtml(formatDate(a.valid_until))}</validUntil>\n`
        + `    <issued>${escapeHtml(formatDate(a.issued_at))}</issued>\n`
        + `    <body_text>${escapeHtml(a.body_text)}</body_text>\n`
        + `  </certificate>\n</certificateExport>\n`;
    return {
        source: { kind: "certificate", sourceId: a.id, copyVariant: "patient" },
        pdfBodyLines,
        pdfLayout,
        csvText,
        jsonText,
        xmlText,
    };
}

function prescriptionPdfLinesSingle(r: Prescription, patient: Patient | null): string[] {
    const kind = prescriptionTypeLabel(r.prescription_type ?? "PRIVAT");
    const autIdem = r.aut_idem !== false;
    return [
        ...practiceHeaderLinesForExport(),
        "",
        docTp("document.print.prescription_heading", { type: kind }),
        docTp("document.print.prescription_number", { number: r.id.slice(0, 8).toUpperCase() }),
        docTp("document.print.prescription_date", { date: formatWrittenDay(r.issued_at) }),
        "",
        docT("document.print.patient_info"),
        docTp("document.print.name_line", { name: patient?.name ?? "—" }),
        patient ? docTp("document.print.dob_line", { dob: formatDate(patient.date_of_birth) }) : "",
        patient?.address?.trim()
            ? docTp("document.print.address", { address: patient.address.trim().replace(/\n/g, ", ") })
            : "",
        patient?.insurance_number
            ? docTp("document.print.insurance_no", { number: patient.insurance_number })
            : "",
        "",
        "Rp.",
        r.medication,
        docTp("document.print.ingredient_line", { value: (r.active_ingredient ?? "").trim() || "—" }),
        docTp("document.print.form", { form: (r.dosage_form ?? "").trim() || "—" }),
        `${docT("document.print.dosage")}: ${r.dosage}`,
        docTp("document.print.duration_of_use", { duration: r.duration }),
        docTp("document.print.pzn", { pzn: (r.pzn ?? "").trim() || "—" }),
        autIdem ? docT("document.print.aut_idem") : docT("document.print.substitution_allowed"),
        "",
        docTp("document.print.usage_notes", { notes: (r.instructions ?? "").trim() || "—" }),
        "",
        ...clinicianSignatureBlock(),
    ].filter((line) => line !== "");
}

export function bundlePrescriptionExport(r: Prescription, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildPrescriptionPdfLayout(r, patient);
    const pdfBodyLines = prescriptionPdfLinesSingle(r, patient);
    const csvText =
        `${csvRow(["Medication", "Ingredient", "Dosage", "Duration", "Notes", "Issued", "Status", "Patient", "DateOfBirth"])}\n`
        + `${csvRow([
            r.medication,
            (r.active_ingredient ?? "").trim(),
            r.dosage,
            r.duration,
            (r.instructions ?? "").trim(),
            formatDate(r.issued_at),
            r.status,
            patient?.name ?? "",
            patient ? formatDate(patient.date_of_birth) : "",
        ])}\n`;
    const jsonObj = {
        documentKind: "prescription",
        prescription: {
            id: r.id,
            patient_id: r.patient_id,
            medication: r.medication,
            active_ingredient: r.active_ingredient,
            dosage: r.dosage,
            duration: r.duration,
            instructions: r.instructions,
            issued_at: r.issued_at,
            status: r.status,
        },
        patient: patient
            ? { id: patient.id, name: patient.name, date_of_birth: patient.date_of_birth }
            : null,
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const px = patient ? `<patient id="${escapeHtml(patient.id)}" name="${escapeHtml(patient.name)}"/>` : "";
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<prescriptionExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  ${px}\n`
        + `  <prescription status="${escapeHtml(r.status)}">\n`
        + `    <medication>${escapeHtml(r.medication)}</medication>\n`
        + `    <dosage>${escapeHtml(r.dosage)}</dosage>\n`
        + `    <duration>${escapeHtml(r.duration)}</duration>\n`
        + `  </prescription>\n</prescriptionExport>\n`;
    return { source: { kind: "prescription", sourceId: r.id }, pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function prescriptionPdfLinesCombo(items: Prescription[], patient: Patient | null): string[] {
    if (items.length === 0) return [docT("document.print.no_prescription")];
    const first = items[0]!;
    const title =
        items.length === 1
            ? docT("document.print.prescription_title").toUpperCase()
            : docTp("document.print.combo_heading", { count: items.length });
    const lines: string[] = [
        ...practiceHeaderLinesForExport(),
        "",
        title,
        docTp("document.print.prescription_date", { date: formatWrittenDay(first.issued_at) }),
        "",
        docT("document.print.patient_info"),
        docTp("document.print.name_line", { name: patient?.name ?? "—" }),
        patient ? docTp("document.print.dob_line", { dob: formatDate(patient.date_of_birth) }) : "",
        "",
        docT("document.print.prescribed_meds"),
        "",
    ];
    for (let i = 0; i < items.length; i++) {
        const r = items[i]!;
        lines.push(
            docTp("document.print.position", { n: i + 1, name: r.medication }),
            docTp("document.print.dosage_duration", { dosage: r.dosage, duration: r.duration }),
        );
        if ((r.active_ingredient ?? "").trim()) {
            lines.push(docTp("document.print.ingredient_line", { value: r.active_ingredient ?? "" }));
        }
        if ((r.pzn ?? "").trim()) lines.push(docTp("document.print.pzn", { pzn: r.pzn ?? "" }));
        if ((r.instructions ?? "").trim()) {
            lines.push(docTp("document.print.notes_line", { value: r.instructions ?? "" }));
        }
        lines.push("");
    }
    lines.push(...clinicianSignatureBlock());
    return lines;
}

export function bundlePrescriptionsComboExport(items: Prescription[], patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildPrescriptionComboPdfLayout(items, patient);
    const pdfBodyLines = prescriptionPdfLinesCombo(items, patient);
    const header = csvRow(["Pos", "Medication", "Ingredient", "Dosage", "Duration", "Notes", "Issued", "Status"]);
    const bodyRows =
        items.length === 0
            ? ""
            : items
                  .map((r, idx) =>
                      csvRow([
                          String(idx + 1),
                          r.medication,
                          (r.active_ingredient ?? "").trim(),
                          r.dosage,
                          r.duration,
                          (r.instructions ?? "").trim(),
                          formatDate(r.issued_at),
                          r.status,
                      ]),
                  )
                  .join("\n") + "\n";
    const csvText = `${header}\n${bodyRows}`;
    const jsonObj = {
        documentKind: "prescription_combo",
        patient: patient
            ? { id: patient.id, name: patient.name, date_of_birth: patient.date_of_birth }
            : null,
        prescriptions: items.map((r) => ({
            id: r.id,
            medication: r.medication,
            active_ingredient: r.active_ingredient,
            dosage: r.dosage,
            duration: r.duration,
            instructions: r.instructions,
            issued_at: r.issued_at,
            status: r.status,
        })),
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<prescriptionComboExport xmlns="urn:medoc:export:clinical-doc:1" count="${items.length}">\n`
        + `${items.map((r, i) => `  <item index="${i + 1}"><med>${escapeHtml(r.medication)}</med></item>`).join("\n")}\n`
        + `</prescriptionComboExport>\n`;
    return {
        source: { kind: "prescription", sourceId: items.map((r) => r.id).sort().join(",") },
        pdfBodyLines,
        pdfLayout,
        csvText,
        jsonText,
        xmlText,
    };
}

function receiptPdfLines(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): string[] {
    const referenceLine = formatPaymentReferenceLine(z, treatments, examinations, docT, docTp);
    const practice = getInvoicePracticeFromStorage();
    const ust =
        (practice.vat_exemption_notice ?? "").trim() || docT("document.print.vat_exempt_default");
    const paymentDate = formatDate(z.created_at);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const moneyOrDash = (n: number | null) =>
        n != null && Number.isFinite(n) ? formatCurrency(n) : "—";
    return [
        ...practiceHeaderLinesForExport(),
        "",
        docT("document.print.receipt_title"),
        "",
        `${docT("document.print.patient")}: ${patient.name}`,
        docTp("document.print.dob_line", { dob: formatDate(patient.date_of_birth) }),
        patient.insurance_number
            ? docTp("document.print.insurance_no", { number: patient.insurance_number })
            : "",
        "",
        `${docT("document.print.payment_date")}: ${paymentDate}`,
        `${docT("document.print.price")}: ${moneyOrDash(prices.billedPrice)}`,
        `${docT("document.print.amount_paid")}: ${formatCurrency(prices.paidPrice)}`,
        `${docT("document.print.payment_method")}: ${paymentMethodLabel(z.payment_method, docT)}`,
        `${docT("common.status")}: ${paymentStatusDisplay(z.status, docT).label}`,
        "",
        docT("document.print.service_assignment"),
        referenceLine,
        `${docT("document.print.description")}: ${(z.description ?? "").trim() || "—"}`,
        "",
        ust,
        docT("document.print.amount_received"),
        "",
        ...clinicianSignatureBlock(false),
    ].filter((line) => line !== "");
}

/** Receipt bundle. The receipt number is allocated by the server when issued. */
export function bundleReceiptExport(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): ClinicalDocumentExportBundle {
    const pdfLayout = buildReceiptPdfLayout(z, patient, treatments, examinations, catalog, services);
    const pdfBodyLines = receiptPdfLines(z, patient, treatments, examinations, catalog, services);
    const referenceLine = formatPaymentReferenceLine(z, treatments, examinations, docT, docTp);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const csvText =
        `${csvRow([
            "Patient",
            "DateOfBirth",
            "PaymentDate",
            `StandardPrice${practiceCurrency()}`,
            `Price${practiceCurrency()}`,
            `AmountPaid${practiceCurrency()}`,
            "PaymentMethod",
            "Status",
            "Assignment",
            "Description",
        ])}\n`
        + `${csvRow([
            patient.name,
            formatDate(patient.date_of_birth),
            formatDate(z.created_at),
            prices.standardPrice != null ? prices.standardPrice.toFixed(2) : "",
            prices.billedPrice != null ? prices.billedPrice.toFixed(2) : "",
            z.amount.toFixed(2),
            paymentMethodLabel(z.payment_method, docT),
            paymentStatusDisplay(z.status, docT).label,
            referenceLine,
            (z.description ?? "").trim(),
        ])}\n`;
    const jsonObj = {
        documentKind: "receipt",
        currency: practiceCurrency(),
        patient: { id: patient.id, name: patient.name, date_of_birth: patient.date_of_birth },
        payment: {
            id: z.id,
            amount: z.amount,
            standardPrice: prices.standardPrice,
            billedPrice: prices.billedPrice,
            amountPaid: prices.paidPrice,
            payment_method: z.payment_method,
            status: z.status,
            description: z.description,
            created_at: z.created_at,
            assignmentText: referenceLine,
        },
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<receiptExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  <currency>${escapeHtml(practiceCurrency())}</currency>\n`
        + `  <standardPrice>${escapeHtml(prices.standardPrice != null ? prices.standardPrice.toFixed(2) : "")}</standardPrice>\n`
        + `  <price>${escapeHtml(prices.billedPrice != null ? prices.billedPrice.toFixed(2) : "")}</price>\n`
        + `  <amountPaid>${escapeHtml(z.amount.toFixed(2))}</amountPaid>\n`
        + `  <assignment>${escapeHtml(referenceLine)}</assignment>\n`
        + `</receiptExport>\n`;
    return { source: { kind: "receipt", sourceId: z.id }, pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}
