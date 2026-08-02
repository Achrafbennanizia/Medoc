import { translateLocale, translateLocaleParams, useLocale, isRtlLocale } from "@/lib/i18n";
import type { Attest } from "@/systems/practice-host/controllers/attest.controller";
import type { Rezept } from "@/systems/practice-host/controllers/rezept.controller";
import { escapeHtml, formatDate, formatCurrency } from "@/lib/utils";
import type { Patient, Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { buildClinicalTemplateKopfLines } from "@/lib/clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1, type PraxisFieldKey } from "@/lib/document-template-schema";
import { loadPraxisHeaderPrivacy } from "@/lib/praxis-header-privacy";
import {
    formatZahlungBezugLine,
    zahlStatusDisplay,
    zahlungsartLabel,
} from "@/lib/zahlung-buchung";
import {
    buildAttestPdfLayout,
    buildQuittungPdfLayout,
    buildRezeptComboPdfLayout,
    buildRezeptPdfLayout,
    type ClinicalPdfLayout,
} from "@/lib/clinical-pdf-layout";

const docT = (key: string) => translateLocale(useLocale.getState().locale, key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(useLocale.getState().locale, key, params);

function htmlLangDir(): { lang: string; dir: string } {
    const loc = useLocale.getState().locale;
    return { lang: loc, dir: isRtlLocale(loc) ? "rtl" : "ltr" };
}

function rezeptStatusLabel(status: string): string {
    const s = status.trim();
    if (s === "AUSGESTELLT") return docT("enum.rezept_status.ausgestellt");
    if (s === "ENTWURF") return docT("enum.rezept_status.entwurf");
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

const CLINICAL_KOPF_FIELDS: PraxisFieldKey[] = [
    "name",
    "address",
    "phone",
    "fax",
    "email",
    "behandler",
    "zanr",
    "bsnr",
    "bank",
    "kammer",
    "kzv",
    "ust_hinweis",
    "notfall_tel",
];

function praxisKopfLinesForExport(): string[] {
    const praxis = getInvoicePraxisFromStorage();
    const tpl = emptyDocumentTemplatePayloadV1();
    tpl.kopf.fieldsToShow = CLINICAL_KOPF_FIELDS;
    return buildClinicalTemplateKopfLines(tpl, praxis, loadPraxisHeaderPrivacy());
}

function formatVerordnungsdatumDe(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

function behandlerSignaturBlock(): string[] {
    const p = getInvoicePraxisFromStorage();
    const bh = (p.behandler_name ?? "").trim();
    const beruf = (p.berufsbezeichnung ?? "").trim();
    const zanr = (p.zanr ?? "").trim();
    const bsnr = (p.bsnr ?? "").trim();
    if (!bh) return [];
    const lines = ["", "____________________________", bh];
    if (beruf) lines.push(beruf);
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

export function suggestAttestExportBasename(a: Attest): string {
    const day = a.ausgestellt_am.slice(0, 10);
    return `Attest_${day}_${a.id.slice(0, 8)}`;
}

export function suggestRezeptExportBasename(r: Rezept): string {
    const day = r.ausgestellt_am.slice(0, 10);
    const slug = r.medikament.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 28).trim() || "Rezept";
    return `Rezept_${day}_${slug}`;
}

export function suggestRezeptComboExportBasename(items: Rezept[]): string {
    if (items.length === 0) return "Rezept";
    const first = items[0]!;
    const day = first.ausgestellt_am.slice(0, 10);
    if (items.length === 1) return suggestRezeptExportBasename(first);
    return `Rezept_Kombination_${day}_${items.length}x`;
}

export function suggestQuittungExportBasename(z: Zahlung): string {
    const day = z.created_at.slice(0, 10);
    return `Quittung_${day}_${z.id.slice(0, 8)}`;
}

/** @deprecated Use suggestAttestExportBasename */
export function suggestAttestHtmlFilename(a: Attest): string {
    return `${suggestAttestExportBasename(a)}.html`;
}

/** @deprecated Use suggestRezeptExportBasename */
export function suggestRezeptHtmlFilename(r: Rezept): string {
    return `${suggestRezeptExportBasename(r)}.html`;
}

/** @deprecated Use suggestRezeptComboExportBasename */
export function suggestRezeptComboHtmlFilename(items: Rezept[]): string {
    return `${suggestRezeptComboExportBasename(items)}.html`;
}

/** @deprecated Use suggestQuittungExportBasename */
export function suggestQuittungHtmlFilename(z: Zahlung): string {
    return `${suggestQuittungExportBasename(z)}.html`;
}

function attestPdfLines(a: Attest, patient: Patient | null): string[] {
    const von = formatDate(a.gueltig_von);
    const bis = formatDate(a.gueltig_bis);
    const ausgestellt = formatDate(a.ausgestellt_am);
    const t0 = new Date(`${a.gueltig_von.slice(0, 10)}T12:00:00`);
    const t1 = new Date(`${a.gueltig_bis.slice(0, 10)}T12:00:00`);
    const days = Math.max(1, Math.round((t1.getTime() - t0.getTime()) / 86_400_000) + 1);
    const erstFolge =
        (a.erst_oder_folge ?? "ERST") === "FOLGE"
            ? docT("document.print.certificate_followup")
            : docT("document.print.certificate_first");
    const pname = patient?.name ?? a.patient_id;
    const geb = patient ? formatDate(patient.geburtsdatum) : "—";
    const icd = (a.icd10_code ?? "").trim() || "—";
    const dobPart = patient ? docTp("document.print.certificate_dob_part", { dob: geb }) : "";
    const plural = days === 1 ? "" : "s";
    const lines: string[] = [
        ...praxisKopfLinesForExport(),
        "",
        docT("document.print.medical_certificate"),
        docTp("document.print.certificate_type", { typ: a.typ, kind: erstFolge }),
        "",
        docTp("document.print.certificate_body", { name: pname, dobPart }),
        "",
        docTp("document.print.validity_period", { from: von, to: bis, days, plural }),
        docTp("document.print.issue_date", { date: ausgestellt }),
    ];
    if (a.typ.toLowerCase().includes("arbeitsunfähig") && (a.arbeitgeber ?? "").trim()) {
        lines.push(docTp("document.print.employer", { name: a.arbeitgeber!.trim() }));
    }
    lines.push(
        docTp("document.print.diagnosis_icd", { code: icd }),
        "",
        docT("document.print.findings"),
        ...a.inhalt.split(/\r?\n/).map((s) => s.trimEnd()),
        "",
        docT("document.print.place_date"),
        ...behandlerSignaturBlock(),
    );
    return lines.map((s) => s.trimEnd());
}

export function bundleAttestExport(a: Attest, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildAttestPdfLayout(a, patient);
    const pdfBodyLines = attestPdfLines(a, patient);
    const geb = patient ? formatDate(patient.geburtsdatum) : "";
    const csvText =
        `${csvRow(["Type", "PatientId", "PatientName", "DateOfBirth", "ValidFrom", "ValidTo", "Issued", "ICD10", "FirstOrFollowUp", "Employer", "Content"])}\n`
        + `${csvRow([
            a.typ,
            a.patient_id,
            patient?.name ?? "",
            geb,
            formatDate(a.gueltig_von),
            formatDate(a.gueltig_bis),
            formatDate(a.ausgestellt_am),
            (a.icd10_code ?? "").trim(),
            a.erst_oder_folge ?? "",
            (a.arbeitgeber ?? "").trim(),
            a.inhalt,
        ])}\n`;
    const jsonObj = {
        documentKind: "attest",
        attest: {
            id: a.id,
            patient_id: a.patient_id,
            typ: a.typ,
            inhalt: a.inhalt,
            gueltig_von: a.gueltig_von,
            gueltig_bis: a.gueltig_bis,
            ausgestellt_am: a.ausgestellt_am,
            icd10_code: a.icd10_code,
            erst_oder_folge: a.erst_oder_folge,
            arbeitgeber: a.arbeitgeber,
        },
        patient: patient
            ? { id: patient.id, name: patient.name, geburtsdatum: patient.geburtsdatum }
            : null,
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const px = patient ? `<patient id="${escapeHtml(patient.id)}" name="${escapeHtml(patient.name)}" geb="${escapeHtml(patient.geburtsdatum)}"/>` : "";
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<attestExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  ${px}\n`
        + `  <attest id="${escapeHtml(a.id)}" typ="${escapeHtml(a.typ)}">\n`
        + `    <gueltigVon>${escapeHtml(formatDate(a.gueltig_von))}</gueltigVon>\n`
        + `    <gueltigBis>${escapeHtml(formatDate(a.gueltig_bis))}</gueltigBis>\n`
        + `    <ausgestellt>${escapeHtml(formatDate(a.ausgestellt_am))}</ausgestellt>\n`
        + `    <inhalt>${escapeHtml(a.inhalt)}</inhalt>\n`
        + `  </attest>\n</attestExport>\n`;
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function rezeptPdfLinesSingle(r: Rezept, patient: Patient | null): string[] {
    const typ = (r.rezept_typ ?? "PRIVAT").trim() || "PRIVAT";
    const autIdem = r.aut_idem !== false;
    return [
        ...praxisKopfLinesForExport(),
        "",
        docTp("document.print.prescription_heading", { type: typ }),
        docTp("document.print.prescription_number", { number: r.id.slice(0, 8).toUpperCase() }),
        docTp("document.print.prescription_date", { date: formatVerordnungsdatumDe(r.ausgestellt_am) }),
        "",
        docT("document.print.patient_info"),
        docTp("document.print.name_line", { name: patient?.name ?? "—" }),
        patient ? docTp("document.print.dob_line", { dob: formatDate(patient.geburtsdatum) }) : "",
        patient?.adresse?.trim()
            ? docTp("document.print.address", { address: patient.adresse.trim().replace(/\n/g, ", ") })
            : "",
        patient?.versicherungsnummer
            ? docTp("document.print.insurance_no", { number: patient.versicherungsnummer })
            : "",
        "",
        "Rp.",
        r.medikament,
        docTp("document.print.ingredient_line", { value: (r.wirkstoff ?? "").trim() || "—" }),
        docTp("document.print.form", { form: (r.darreichungsform ?? "").trim() || "—" }),
        `${docT("document.print.dosage")}: ${r.dosierung}`,
        docTp("document.print.duration_of_use", { duration: r.dauer }),
        docTp("document.print.pack_size", { size: (r.packungsgroesse ?? "").trim() || "—" }),
        r.menge != null ? docTp("document.print.quantity", { qty: r.menge }) : "",
        docTp("document.print.pzn", { pzn: (r.pzn ?? "").trim() || "—" }),
        autIdem ? docT("document.print.aut_idem") : docT("document.print.substitution_allowed"),
        "",
        docTp("document.print.usage_notes", { notes: (r.hinweise ?? "").trim() || "—" }),
        "",
        ...behandlerSignaturBlock(),
    ].filter((line) => line !== "");
}

export function bundleRezeptExport(r: Rezept, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildRezeptPdfLayout(r, patient);
    const pdfBodyLines = rezeptPdfLinesSingle(r, patient);
    const csvText =
        `${csvRow(["Medication", "Ingredient", "Dosage", "Duration", "Notes", "Issued", "Status", "Patient", "DateOfBirth"])}\n`
        + `${csvRow([
            r.medikament,
            (r.wirkstoff ?? "").trim(),
            r.dosierung,
            r.dauer,
            (r.hinweise ?? "").trim(),
            formatDate(r.ausgestellt_am),
            r.status,
            patient?.name ?? "",
            patient ? formatDate(patient.geburtsdatum) : "",
        ])}\n`;
    const jsonObj = {
        documentKind: "rezept",
        rezept: {
            id: r.id,
            patient_id: r.patient_id,
            medikament: r.medikament,
            wirkstoff: r.wirkstoff,
            dosierung: r.dosierung,
            dauer: r.dauer,
            hinweise: r.hinweise,
            ausgestellt_am: r.ausgestellt_am,
            status: r.status,
        },
        patient: patient
            ? { id: patient.id, name: patient.name, geburtsdatum: patient.geburtsdatum }
            : null,
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const px = patient ? `<patient id="${escapeHtml(patient.id)}" name="${escapeHtml(patient.name)}"/>` : "";
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<rezeptExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  ${px}\n`
        + `  <rezept status="${escapeHtml(r.status)}">\n`
        + `    <medikament>${escapeHtml(r.medikament)}</medikament>\n`
        + `    <dosierung>${escapeHtml(r.dosierung)}</dosierung>\n`
        + `    <dauer>${escapeHtml(r.dauer)}</dauer>\n`
        + `  </rezept>\n</rezeptExport>\n`;
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function rezeptPdfLinesCombo(items: Rezept[], patient: Patient | null): string[] {
    if (items.length === 0) return [docT("document.print.no_prescription")];
    const first = items[0]!;
    const title =
        items.length === 1
            ? docT("document.print.prescription_title").toUpperCase()
            : docTp("document.print.combo_heading", { count: items.length });
    const lines: string[] = [
        ...praxisKopfLinesForExport(),
        "",
        title,
        docTp("document.print.prescription_date", { date: formatVerordnungsdatumDe(first.ausgestellt_am) }),
        "",
        docT("document.print.patient_info"),
        docTp("document.print.name_line", { name: patient?.name ?? "—" }),
        patient ? docTp("document.print.dob_line", { dob: formatDate(patient.geburtsdatum) }) : "",
        "",
        docT("document.print.prescribed_meds"),
        "",
    ];
    for (let i = 0; i < items.length; i++) {
        const r = items[i]!;
        lines.push(
            docTp("document.print.position", { n: i + 1, name: r.medikament }),
            docTp("document.print.dosage_duration", { dosage: r.dosierung, duration: r.dauer }),
        );
        if ((r.wirkstoff ?? "").trim()) {
            lines.push(docTp("document.print.ingredient_line", { value: r.wirkstoff }));
        }
        if ((r.pzn ?? "").trim()) lines.push(docTp("document.print.pzn", { pzn: r.pzn }));
        if ((r.hinweise ?? "").trim()) {
            lines.push(docTp("document.print.notes_line", { value: r.hinweise }));
        }
        lines.push("");
    }
    lines.push(...behandlerSignaturBlock());
    return lines;
}

export function bundleRezepteComboExport(items: Rezept[], patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfLayout = buildRezeptComboPdfLayout(items, patient);
    const pdfBodyLines = rezeptPdfLinesCombo(items, patient);
    const header = csvRow(["Pos", "Medication", "Ingredient", "Dosage", "Duration", "Notes", "Issued", "Status"]);
    const bodyRows =
        items.length === 0
            ? ""
            : items
                  .map((r, idx) =>
                      csvRow([
                          String(idx + 1),
                          r.medikament,
                          (r.wirkstoff ?? "").trim(),
                          r.dosierung,
                          r.dauer,
                          (r.hinweise ?? "").trim(),
                          formatDate(r.ausgestellt_am),
                          r.status,
                      ]),
                  )
                  .join("\n") + "\n";
    const csvText = `${header}\n${bodyRows}`;
    const jsonObj = {
        documentKind: "rezept_combo",
        patient: patient
            ? { id: patient.id, name: patient.name, geburtsdatum: patient.geburtsdatum }
            : null,
        rezepte: items.map((r) => ({
            id: r.id,
            medikament: r.medikament,
            wirkstoff: r.wirkstoff,
            dosierung: r.dosierung,
            dauer: r.dauer,
            hinweise: r.hinweise,
            ausgestellt_am: r.ausgestellt_am,
            status: r.status,
        })),
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<rezeptComboExport xmlns="urn:medoc:export:clinical-doc:1" count="${items.length}">\n`
        + `${items.map((r, i) => `  <item index="${i + 1}"><med>${escapeHtml(r.medikament)}</med></item>`).join("\n")}\n`
        + `</rezeptComboExport>\n`;
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

function quittungPdfLines(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    receiptNumber: string,
): string[] {
    const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen, docT, docTp);
    const praxis = getInvoicePraxisFromStorage();
    const ust =
        (praxis.ust_befreiung_hinweis ?? "").trim() || docT("document.print.vat_exempt_default");
    const bankLines: string[] = [];
    const iban = (praxis.bankverbindung_iban ?? "").trim();
    if (iban) {
        const bic = (praxis.bankverbindung_bic ?? "").trim();
        const bank = (praxis.bankverbindung_bank ?? "").trim();
        bankLines.push(
            docTp("document.print.bank_details", {
                iban,
                bicPart: bic ? ` BIC ${bic}` : "",
                bankPart: bank ? ` · ${bank}` : "",
            }),
        );
        const inh = (praxis.bankverbindung_inhaber ?? "").trim();
        if (inh) bankLines.push(docTp("document.print.account_holder", { name: inh }));
    }
    const received =
        z.zahlungsart === "BAR" || z.zahlungsart === "KARTE"
            ? docT("document.print.amount_received")
            : "";
    const zahlDatum = formatDate(z.created_at);
    return [
        ...praxisKopfLinesForExport(),
        "",
        docT("document.print.receipt_heading"),
        docTp("document.print.receipt_no", { number: receiptNumber }),
        "",
        `${docT("document.print.patient")}: ${patient.name}`,
        docTp("document.print.dob_line", { dob: formatDate(patient.geburtsdatum) }),
        patient.versicherungsnummer
            ? docTp("document.print.insurance_no", { number: patient.versicherungsnummer })
            : "",
        "",
        `${docT("document.print.payment_date")}: ${zahlDatum}`,
        `${docT("document.print.amount")}: ${formatCurrency(z.betrag)}`,
        `${docT("document.print.payment_method")}: ${zahlungsartLabel(z.zahlungsart, docT)}`,
        `${docT("common.status")}: ${zahlStatusDisplay(z.status, docT).label}`,
        "",
        docT("document.print.service_assignment"),
        bezugLine,
        `${docT("document.print.description")}: ${(z.beschreibung ?? "").trim() || "—"}`,
        "",
        ust,
        received,
        ...bankLines,
        "",
        ...behandlerSignaturBlock(),
    ].filter((line) => line !== "");
}

export function bundleQuittungExport(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    receiptNumber: string,
): ClinicalDocumentExportBundle {
    const pdfLayout = buildQuittungPdfLayout(z, patient, behandlungen, untersuchungen, receiptNumber);
    const pdfBodyLines = quittungPdfLines(z, patient, behandlungen, untersuchungen, receiptNumber);
    const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen, docT, docTp);
    const csvText =
        `${csvRow(["Patient", "DateOfBirth", "PaymentDate", "AmountEUR", "PaymentMethod", "Status", "Assignment", "Description"])}\n`
        + `${csvRow([
            patient.name,
            formatDate(patient.geburtsdatum),
            formatDate(z.created_at),
            z.betrag.toFixed(2),
            zahlungsartLabel(z.zahlungsart, docT),
            zahlStatusDisplay(z.status, docT).label,
            bezugLine,
            (z.beschreibung ?? "").trim(),
        ])}\n`;
    const jsonObj = {
        documentKind: "quittung",
        patient: { id: patient.id, name: patient.name, geburtsdatum: patient.geburtsdatum },
        zahlung: {
            id: z.id,
            betrag: z.betrag,
            zahlungsart: z.zahlungsart,
            status: z.status,
            beschreibung: z.beschreibung,
            created_at: z.created_at,
            zuordnungText: bezugLine,
        },
    };
    const jsonText = `${JSON.stringify(jsonObj, null, 2)}\n`;
    const xmlText =
        `<?xml version="1.0" encoding="UTF-8"?>\n<quittungExport xmlns="urn:medoc:export:clinical-doc:1">\n`
        + `  <betrag>${escapeHtml(z.betrag.toFixed(2))}</betrag>\n`
        + `  <zuordnung>${escapeHtml(bezugLine)}</zuordnung>\n`
        + `</quittungExport>\n`;
    return { pdfBodyLines, pdfLayout, csvText, jsonText, xmlText };
}

export function buildAttestPrintHtml(a: Attest, patient: Patient | null): string {
    const title = escapeHtml(`Attest ${a.id}`);
    const typ = escapeHtml(a.typ);
    const patientLine = escapeHtml(patient?.name ?? a.patient_id);
    const geb = patient ? escapeHtml(formatDate(patient.geburtsdatum)) : "";
    const span = `${escapeHtml(formatDate(a.gueltig_von))} – ${escapeHtml(formatDate(a.gueltig_bis))}`;
    const aus = escapeHtml(formatDate(a.ausgestellt_am));
    const bodyHtml = escapeHtml(a.inhalt);
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${title}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt}.row{margin:0.3cm 0}.label{display:inline-block;width:4cm;color:#555}
            .body{margin:1cm 0;white-space:pre-wrap}</style></head><body>
            <h1>${typ}</h1>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.patient"))}:</span>${patientLine}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date_of_birth"))}:</span>${geb}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.valid"))}</span>${span}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.issued"))}</span>${aus}</div>
            <hr/>
            <div class="body">${bodyHtml}</div>
            <p style="margin-top:3cm">______________________<br/>${docT("document.print.signature")}</p>
            </body></html>`;
}

function rezeptSectionBlock(r: Rezept): string {
    return `<section class="rx">
            <div class="row"><span class="label">${escapeHtml(docT("document.print.medication"))}:</span><strong>${escapeHtml(r.medikament)}</strong></div>
            ${r.wirkstoff?.trim() ? `<div class="row"><span class="label">${escapeHtml(docT("document.print.active_ingredient"))}:</span>${escapeHtml(r.wirkstoff)}</div>` : ""}
            <div class="row"><span class="label">${escapeHtml(docT("document.print.dosage"))}:</span>${escapeHtml(r.dosierung)}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.duration"))}:</span>${escapeHtml(r.dauer)}</div>
            ${r.hinweise?.trim() ? `<div class="row"><span class="label">${escapeHtml(docT("document.print.notes"))}:</span>${escapeHtml(r.hinweise)}</div>` : ""}
        </section>`;
}

/** Single prescription — table layout (Akte / compact view). */
export function buildRezeptPrintHtml(r: Rezept, patient: Patient | null): string {
    const med = escapeHtml(r.medikament);
    const wirk = escapeHtml((r.wirkstoff ?? "").trim() || "—");
    const dos = escapeHtml(r.dosierung);
    const dauer = escapeHtml(r.dauer);
    const hin = escapeHtml((r.hinweise ?? "").trim() || "—");
    const patientLine = escapeHtml(patient?.name ?? "");
    const geb = patient ? escapeHtml(formatDate(patient.geburtsdatum)) : "";
    const aus = escapeHtml(formatDate(r.ausgestellt_am));
    const statusLabel = escapeHtml(rezeptStatusLabel(r.status));
    const rxTitle = escapeHtml(docT("document.print.prescription_title"));
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${rxTitle}</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#111;line-height:1.45}
              h1{font-size:20px;margin:0 0 16px}
              table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;vertical-align:top}
              th{background:#f4f4f4;font-weight:600;width:34%}
              .muted{color:#555;font-size:11px;margin-top:28px}
            </style></head><body>
            <h1>${rxTitle}</h1>
            <table aria-label="${escapeHtml(docT("document.print.prescription_master_aria"))}">
              <tbody>
                <tr><th scope="row">${escapeHtml(docT("document.print.patient"))}</th><td>${patientLine}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.date_of_birth"))}</th><td>${geb}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.issued_on"))}</th><td>${aus}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("common.status"))}</th><td>${statusLabel}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.medication"))}</th><td>${med}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.active_ingredient"))}</th><td>${wirk}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.dosage"))}</th><td>${dos}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.duration"))}</th><td>${dauer}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.notes"))}</th><td>${hin}</td></tr>
              </tbody>
            </table>
            <p style="margin-top:48px">______________________<br/><span style="font-size:12px">${docT("document.print.signature")}</span></p>
            <p class="muted">${escapeHtml(docT("document.print.printed_from"))}</p>
            </body></html>`;
}

/** Multiple prescriptions on one printout (prescription overview). */
export function buildRezepteComboPrintHtml(items: Rezept[], patient: Patient | null): string {
    if (items.length === 0) {
        return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${escapeHtml(docT("document.print.prescription_title"))}</title></head><body><p>${docT("document.print.no_prescription")}</p></body></html>`;
    }
    const first = items[0]!;
    const title =
        items.length === 1
            ? docT("document.print.prescription_title")
            : docTp("document.print.prescription_combo_title", { count: items.length });
    const datum = formatDate(first.ausgestellt_am);
    const patientLine = escapeHtml(patient?.name ?? "");
    const geb = patient ? escapeHtml(formatDate(patient.geburtsdatum)) : "";
    const body = items.map(rezeptSectionBlock).join("");
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt;margin-bottom:0.4cm}h2{font-size:13pt;margin:0.4cm 0 0.2cm;color:#333}
            .row{margin:0.25cm 0}.label{display:inline-block;width:4cm;color:#555}
            .rx{border-top:1px solid #ddd;padding-top:0.4cm;margin-top:0.4cm}
            .rx:first-of-type{border-top:none;margin-top:0;padding-top:0}</style>
            </head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.patient"))}:</span>${patientLine}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date_of_birth"))}:</span>${geb}</div>
            <div class="row"><span class="label">${escapeHtml(docT("document.print.date"))}:</span>${escapeHtml(datum)}</div>
            <hr/>
            ${body}
            <p style="margin-top:3cm">______________________<br/>${docT("document.print.signature")}</p>
            </body></html>`;
}

export function buildQuittungPrintHtml(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): string {
    const bezugLine = escapeHtml(formatZahlungBezugLine(z, behandlungen, untersuchungen, docT, docTp));
    const art = escapeHtml(zahlungsartLabel(z.zahlungsart, docT));
    const stat = escapeHtml(zahlStatusDisplay(z.status, docT).label);
    const bet = escapeHtml(`${z.betrag.toFixed(2)} EUR`);
    const quando = escapeHtml(formatDate(z.created_at));
    const beschr = escapeHtml((z.beschreibung ?? "").trim() || "—");
    const pname = escapeHtml(patient.name);
    const geb = escapeHtml(formatDate(patient.geburtsdatum));
    const receiptTitle = escapeHtml(docT("document.print.receipt_title"));
    return `<!doctype html><html lang="${htmlLangDir().lang}" dir="${htmlLangDir().dir}"><head><meta charset="utf-8"/><title>${receiptTitle}</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:28px;color:#111;line-height:1.45}
              h1{font-size:18px;margin:0 0 6px}
              table{border-collapse:collapse;width:100%;margin:18px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
              th{background:#f4f4f4;width:38%}
              .muted{color:#555;font-size:11px;margin-top:24px}
            </style></head><body>
            <h1>${escapeHtml(docT("document.print.receipt_title"))}</h1>
            <table>
              <tbody>
                <tr><th scope="row">${escapeHtml(docT("document.print.patient"))}</th><td>${pname}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.date_of_birth"))}</th><td>${geb}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.payment_date"))}</th><td>${quando}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.amount"))}</th><td><strong>${bet}</strong></td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.payment_method"))}</th><td>${art}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("common.status"))}</th><td>${stat}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.assignment"))}</th><td>${bezugLine}</td></tr>
                <tr><th scope="row">${escapeHtml(docT("document.print.description"))}</th><td>${beschr}</td></tr>
              </tbody>
            </table>
            <p class="muted">${escapeHtml(docT("document.print.printed_from"))}</p>
            </body></html>`;
}
