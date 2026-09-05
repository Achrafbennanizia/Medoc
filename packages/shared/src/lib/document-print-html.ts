import { translateLocale, translateLocaleParams, useLocale, isRtlLocale } from "@/lib/i18n";
import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { escapeHtml, formatDate, formatCurrency } from "@/lib/utils";
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
import { loadPracticeHeaderPrivacy } from "@/lib/practice-header-privacy";
import {
    formatPaymentReferenceLine,
    paymentStatusDisplay,
    paymentMethodLabel,
} from "@/lib/payment-booking";
import {
    buildCertificatePdfLayout,
    buildReceiptPdfLayout,
    buildPrescriptionComboPdfLayout,
    buildPrescriptionPdfLayout,
    receiptPriceBreakdown,
    type ClinicalPdfLayout,
} from "@/lib/clinical-pdf-layout";

const docT = (key: string) => translateLocale(useLocale.getState().locale, key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(useLocale.getState().locale, key, params);

function htmlLangDir(): { lang: string; dir: string } {
    const loc = useLocale.getState().locale;
    return { lang: loc, dir: isRtlLocale(loc) ? "rtl" : "ltr" };
}

const PRACTICE_LOGO_LS_KEY = "medoc-practice-logo-v1";

/** Sync logo cache for HTML print (Settings also writes this when saving). */
export function cachePracticeLogoForPrint(mime: string, dataBase64: string): void {
    try {
        localStorage.setItem(PRACTICE_LOGO_LS_KEY, JSON.stringify({ mime, data: dataBase64 }));
    } catch {
        /* ignore */
    }
}

function practiceLogoDataUrl(): string | null {
    try {
        const raw = localStorage.getItem(PRACTICE_LOGO_LS_KEY);
        if (!raw) return null;
        const j = JSON.parse(raw) as { mime?: string; data?: string };
        if (!j.mime || !j.data) return null;
        return `data:${j.mime};base64,${j.data}`;
    } catch {
        return null;
    }
}

function printLetterheadHtml(): string {
    const logo = practiceLogoDataUrl();
    if (!logo) {
        // No uploaded logo → classic print template (no logo chrome).
        return "";
    }
    const { dir } = htmlLangDir();
    return `<div class="letterhead" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-direction:${dir === "rtl" ? "row-reverse" : "row"}">
      <img class="practice-logo" src="${logo}" alt="" />
      <div class="letterhead-spacer" style="flex:1"></div>
    </div>`;
}

function printDocChromeCss(): string {
    return `.practice-logo{height:48px;width:auto;max-width:120px;object-fit:contain}`;
}

function prescriptionStatusLabel(status: string): string {
    const s = status.trim();
    if (s === "ISSUED") return docT("enum.prescription_status.issued");
    if (s === "DRAFT") return docT("enum.prescription_status.draft");
    return s || "—";
}

function csvCell(raw: string): string {
    if (raw.includes(";") || raw.includes("\r") || raw.includes("\n") || raw.includes('"')) {
        return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
}

function csvRow(cells: string[]): string {
    return cells.map(csvCell).join(";");
}

const CLINICAL_HEADER_FIELDS: PracticeFieldKey[] = [
    "name",
    "address",
    "phone",
    "fax",
    "email",
    "clinician",
    "zanr",
    "bsnr",
    "bank",
    "chamber",
    "kzv",
    "vat_notice",
    "emergency_phone",
];

function practiceHeaderLinesForExport(): string[] {
    const practice = getInvoicePracticeFromStorage();
    const tpl = emptyDocumentTemplatePayloadV1();
    tpl.header.fieldsToShow = CLINICAL_HEADER_FIELDS;
    return buildClinicalTemplateHeaderLines(tpl, practice, loadPracticeHeaderPrivacy());
}

function formatPrescriptionDate(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

function clinicianSignatureBlock(): string[] {
    const p = getInvoicePracticeFromStorage();
    const bh = (p.clinician_name ?? "").trim();
    const professionalTitle = (p.professional_title ?? "").trim();
    const zanr = (p.zanr ?? "").trim();
    const bsnr = (p.bsnr ?? "").trim();
    if (!bh) return [];
    const lines = ["", "____________________________", bh];
    if (professionalTitle) lines.push(professionalTitle);
    if (zanr || bsnr) lines.push(`ZANR: ${zanr || "—"} · BSNR: ${bsnr || "—"}`);
    lines.push(docT("document.print.stamp"));
    return lines;
}

/** Data package for clinical document export (PDF/CSV/JSON/XML). */
export type ClinicalDocumentExportBundle = {
    /** Lines for PDF renderer (`preview_document_pdf`). */
    pdfBodyLines: string[];
    /** Structured layout (Rust); preferred over `pdfBodyLines`. */
    pdfLayout: ClinicalPdfLayout;
    csvText: string;
    jsonText: string;
    xmlText: string;
};

export function suggestCertificateExportBasename(a: Certificate): string {
    const day = a.issued_at.slice(0, 10);
    return `Certificate_${day}_${a.id.slice(0, 8)}`;
}

export function suggestPrescriptionExportBasename(r: Prescription): string {
    const day = r.issued_at.slice(0, 10);
    const slug = r.medication.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 28).trim() || "Prescription";
    return `Prescription_${day}_${slug}`;
}

export function suggestPrescriptionComboExportBasename(items: Prescription[]): string {
    if (items.length === 0) return "Prescription";
    const first = items[0]!;
    const day = first.issued_at.slice(0, 10);
    if (items.length === 1) return suggestPrescriptionExportBasename(first);
    return `prescription_combo_${day}_${items.length}x`;
}

export function suggestReceiptExportBasename(z: Payment): string {
    const day = z.created_at.slice(0, 10);
    return `Receipt_${day}_${z.id.slice(0, 8)}`;
}

/** @deprecated Use suggestCertificateExportBasename */
export function suggestCertificateHtmlFilename(a: Certificate): string {
    return `${suggestCertificateExportBasename(a)}.html`;
}

/** @deprecated Use suggestPrescriptionExportBasename */
export function suggestPrescriptionHtmlFilename(r: Prescription): string {
    return `${suggestPrescriptionExportBasename(r)}.html`;
}

/** @deprecated Use suggestPrescriptionComboExportBasename */
export function suggestPrescriptionComboHtmlFilename(items: Prescription[]): string {
    return `${suggestPrescriptionComboExportBasename(items)}.html`;
}

/** @deprecated Use suggestReceiptExportBasename */
export function suggestReceiptHtmlFilename(z: Payment): string {
    return `${suggestReceiptExportBasename(z)}.html`;
}

function certificatePdfLines(a: Certificate, patient: Patient | null): string[] {
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
    const dob = patient ? formatDate(patient.date_of_birth) : "—";
    const icd = (a.icd10_code ?? "").trim() || "—";
    const dobPart = patient ? docTp("document.print.certificate_dob_part", { dob }) : "";
    const plural = days === 1 ? "" : "s";
    const lines: string[] = [
        ...practiceHeaderLinesForExport(),
        "",
        docT("document.print.medical_certificate"),
        docTp("document.print.certificate_type", { kind: a.kind, issue: firstOrFollowUp }),
        "",
        docTp("document.print.certificate_body", { name: pname, dobPart }),
        "",
        docTp("document.print.validity_period", { from: from, to: until, days, plural }),
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
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function prescriptionPdfLinesSingle(r: Prescription, patient: Patient | null): string[] {
    const kind = (r.prescription_type ?? "PRIVAT").trim() || "PRIVAT";
    const autIdem = r.aut_idem !== false;
    return [
        ...practiceHeaderLinesForExport(),
        "",
        docTp("document.print.prescription_heading", { type: kind }),
        docTp("document.print.prescription_number", { number: r.id.slice(0, 8).toUpperCase() }),
        docTp("document.print.prescription_date", { date: formatPrescriptionDate(r.issued_at) }),
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
        docTp("document.print.pack_size", { size: (r.pack_size ?? "").trim() || "—" }),
        r.quantity != null ? docTp("document.print.quantity", { qty: r.quantity }) : "",
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
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
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
        docTp("document.print.prescription_date", { date: formatPrescriptionDate(first.issued_at) }),
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
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function receiptPdfLines(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    receiptNumber: string,
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): string[] {
    const referenceLine = formatPaymentReferenceLine(z, treatments, examinations, docT, docTp);
    const practice = getInvoicePracticeFromStorage();
    const ust =
        (practice.vat_exemption_notice ?? "").trim() || docT("document.print.vat_exempt_default");
    const bankLines: string[] = [];
    const iban = (practice.bank_iban ?? "").trim();
    if (iban) {
        const bic = (practice.bank_bic ?? "").trim();
        const bank = (practice.bank_name ?? "").trim();
        bankLines.push(
            docTp("document.print.bank_details", {
                iban,
                bicPart: bic ? ` BIC ${bic}` : "",
                bankPart: bank ? ` · ${bank}` : "",
            }),
        );
        const inh = (practice.account_holder ?? "").trim();
        if (inh) bankLines.push(docTp("document.print.account_holder", { name: inh }));
    }
    const received =
        z.payment_method === "CASH" || z.payment_method === "CARD"
            ? docT("document.print.amount_received")
            : "";
    const paymentDate = formatDate(z.created_at);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const moneyOrDash = (n: number | null) =>
        n != null && Number.isFinite(n) ? formatCurrency(n) : "—";
    return [
        ...practiceHeaderLinesForExport(),
        "",
        docT("document.print.receipt_heading"),
        docTp("document.print.receipt_no", { number: receiptNumber }),
        "",
        `${docT("document.print.patient")}: ${patient.name}`,
        docTp("document.print.dob_line", { dob: formatDate(patient.date_of_birth) }),
        patient.insurance_number
            ? docTp("document.print.insurance_no", { number: patient.insurance_number })
            : "",
        "",
        `${docT("document.print.payment_date")}: ${paymentDate}`,
        `${docT("document.print.standard_price")}: ${moneyOrDash(prices.standardPrice)}`,
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
        received,
        ...bankLines,
        "",
        ...clinicianSignatureBlock(),
    ].filter((line) => line !== "");
}

export function bundleReceiptExport(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
    receiptNumber: string,
    catalog: TreatmentCatalogItem[] = [],
    services: ServiceItem[] = [],
): ClinicalDocumentExportBundle {
    const pdfLayout = buildReceiptPdfLayout(
        z,
        patient,
        treatments,
        examinations,
        receiptNumber,
        catalog,
        services,
    );
    const pdfBodyLines = receiptPdfLines(
        z,
        patient,
        treatments,
        examinations,
        receiptNumber,
        catalog,
        services,
    );
    const referenceLine = formatPaymentReferenceLine(z, treatments, examinations, docT, docTp);
    const prices = receiptPriceBreakdown(z, treatments, examinations, catalog, services);
    const csvText =
        `${csvRow([
            "Patient",
            "DateOfBirth",
            "PaymentDate",
            "StandardPriceEUR",
            "PriceEUR",
            "AmountPaidEUR",
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
        + `  <standardPrice>${escapeHtml(prices.standardPrice != null ? prices.standardPrice.toFixed(2) : "")}</standardPrice>\n`
        + `  <price>${escapeHtml(prices.billedPrice != null ? prices.billedPrice.toFixed(2) : "")}</price>\n`
        + `  <amountPaid>${escapeHtml(z.amount.toFixed(2))}</amountPaid>\n`
        + `  <assignment>${escapeHtml(referenceLine)}</assignment>\n`
        + `</receiptExport>\n`;
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

export function buildCertificatePrintHtml(a: Certificate, patient: Patient | null): string {
    const title = escapeHtml(`Certificate ${a.id}`);
    const kind = escapeHtml(a.kind);
    const patientLine = escapeHtml(patient?.name ?? a.patient_id);
    const dob = patient ? escapeHtml(formatDate(patient.date_of_birth)) : "";
    const span = `${escapeHtml(formatDate(a.valid_from))} – ${escapeHtml(formatDate(a.valid_until))}`;
    const issuedOn = escapeHtml(formatDate(a.issued_at));
    const bodyHtml = escapeHtml(a.body_text);
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${title}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt}.row{margin:0.3cm 0}.label{display:inline-block;width:4cm;color:#555}
            .body{margin:1cm 0;white-space:pre-wrap}
            .practice-logo{height:48px;width:auto;max-width:120px;object-fit:contain}</style></head><body>
            ${printLetterheadHtml()}
            <h1>${kind}</h1>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.patient"))}:</span>${patientLine}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date_of_birth"))}:</span>${dob}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.valid"))}</span>${span}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.issued"))}</span>${issuedOn}</div>
            <hr/>
            <div class="body">${bodyHtml}</div>
            <p style="margin-top:3cm">______________________<br/>${docT("document.print.signature")}</p>
            </body></html>`;
}

function prescriptionSectionBlock(r: Prescription): string {
    return `<section class="rx">
            <div class="row"><span class="label">${escapeHtml(docT("document.print.medication"))}:</span><strong>${escapeHtml(r.medication)}</strong></div>
            ${r.active_ingredient?.trim() ? `<div class="row"><span class="label">${escapeHtml(docT("document.print.active_ingredient"))}:</span>${escapeHtml(r.active_ingredient)}</div>` : ""}
            <div class="row"><span class="label">${escapeHtml(docT("document.print.dosage"))}:</span>${escapeHtml(r.dosage)}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.duration"))}:</span>${escapeHtml(r.duration)}</div>
            ${r.instructions?.trim() ? `<div class="row"><span class="label">${escapeHtml(docT("document.print.notes"))}:</span>${escapeHtml(r.instructions)}</div>` : ""}
        </section>`;
}

/** Single prescription — table layout (Chart / compact view). */
export function buildPrescriptionPrintHtml(r: Prescription, patient: Patient | null): string {
    const med = escapeHtml(r.medication);
    const wirk = escapeHtml((r.active_ingredient ?? "").trim() || "—");
    const dos = escapeHtml(r.dosage);
    const duration = escapeHtml(r.duration);
    const hin = escapeHtml((r.instructions ?? "").trim() || "—");
    const patientLine = escapeHtml(patient?.name ?? "");
    const dob = patient ? escapeHtml(formatDate(patient.date_of_birth)) : "";
    const issuedOn = escapeHtml(formatDate(r.issued_at));
    const statusLabel = escapeHtml(prescriptionStatusLabel(r.status));
    const rxTitle = escapeHtml(docT("document.print.prescription_title"));
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${rxTitle}</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#111;line-height:1.45}
              h1{font-size:20px;margin:0 0 16px}
              table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;vertical-align:top}
              th{background:#f4f4f4;font-weight:600;width:34%}
              .muted{color:#555;font-size:11px;margin-top:28px}
            ${printDocChromeCss()}</style></head><body>
            ${printLetterheadHtml()}
            <h1>${rxTitle}</h1>
            <table aria-label="${escapeHtml(docT("document.print.prescription_master_aria"))}">
              <tbody>
                <tr><th scope="row">${escapeHtml(docT("document.print.patient"))}</th><td>${patientLine}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.date_of_birth"))}</th><td>${dob}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.issued_on"))}</th><td>${issuedOn}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("common.status"))}</th><td>${statusLabel}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.medication"))}</th><td>${med}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.active_ingredient"))}</th><td>${wirk}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.dosage"))}</th><td>${dos}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.duration"))}</th><td>${duration}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.notes"))}</th><td>${hin}</td></tr>
              </tbody>
            </table>
            <p style="margin-top:48px">______________________<br/><span style="font-size:12px">${docT("document.print.signature")}</span></p>
            <p class="muted">${escapeHtml(docT("document.print.printed_from"))}</p>
            </body></html>`;
}

/** Multiple prescriptions on one printout (prescription overview). */
export function buildPrescriptionsComboPrintHtml(items: Prescription[], patient: Patient | null): string {
    if (items.length === 0) {
        return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${escapeHtml(docT("document.print.prescription_title"))}</title></head><body>
            ${printLetterheadHtml()}<p>${docT("document.print.no_prescription")}</p></body></html>`;
    }
    const first = items[0]!;
    const title =
        items.length === 1
            ? docT("document.print.prescription_title")
            : docTp("document.print.prescription_combo_title", { count: items.length });
    const date = formatDate(first.issued_at);
    const patientLine = escapeHtml(patient?.name ?? "");
    const dob = patient ? escapeHtml(formatDate(patient.date_of_birth)) : "";
    const body = items.map(prescriptionSectionBlock).join("");
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt;margin-bottom:0.4cm}h2{font-size:13pt;margin:0.4cm 0 0.2cm;color:#333}
            .row{margin:0.25cm 0}.label{display:inline-block;width:4cm;color:#555}
            .rx{border-top:1px solid #ddd;padding-top:0.4cm;margin-top:0.4cm}
            .rx:first-of-type{border-top:none;margin-top:0;padding-top:0} ${printDocChromeCss()}</style>
            </head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.patient"))}:</span>${patientLine}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date_of_birth"))}:</span>${dob}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date"))}:</span>${escapeHtml(date)}</div>
            <hr/>
            ${body}
            <p style="margin-top:3cm">______________________<br/>${docT("document.print.signature")}</p>
            </body></html>`;
}

export function buildReceiptPrintHtml(
    z: Payment,
    patient: Patient,
    treatments: Treatment[],
    examinations: Examination[],
): string {
    const referenceLine = escapeHtml(formatPaymentReferenceLine(z, treatments, examinations, docT, docTp));
    const kind = escapeHtml(paymentMethodLabel(z.payment_method, docT));
    const stat = escapeHtml(paymentStatusDisplay(z.status, docT).label);
    const bet = escapeHtml(`${z.amount.toFixed(2)} EUR`);
    const quando = escapeHtml(formatDate(z.created_at));
    const beschr = escapeHtml((z.description ?? "").trim() || "—");
    const pname = escapeHtml(patient.name);
    const dob = escapeHtml(formatDate(patient.date_of_birth));
    const receiptTitle = escapeHtml(docT("document.print.receipt_title"));
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${receiptTitle}</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:28px;color:#111;line-height:1.45}
              h1{font-size:18px;margin:0 0 6px}
              table{border-collapse:collapse;width:100%;margin:18px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
              th{background:#f4f4f4;width:38%}
              .muted{color:#555;font-size:11px;margin-top:24px}
            ${printDocChromeCss()}</style></head><body>
            ${printLetterheadHtml()}
            <h1>${escapeHtml(docT("document.print.receipt_title"))}</h1>
            <table>
              <tbody>
                <tr><th scope="row">${escapeHtml(docT("document.print.patient"))}</th><td>${pname}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.date_of_birth"))}</th><td>${dob}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.payment_date"))}</th><td>${quando}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.amount"))}</th><td><strong>${bet}</strong></td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.payment_method"))}</th><td>${kind}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("common.status"))}</th><td>${stat}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.assignment"))}</th><td>${referenceLine}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.description"))}</th><td>${beschr}</td></tr>
              </tbody>
            </table>
            <p class="muted">${escapeHtml(docT("document.print.printed_from"))}</p>
            </body></html>`;
}
