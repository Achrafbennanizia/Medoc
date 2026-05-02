import type { Attest } from "@/controllers/attest.controller";
import type { Rezept } from "@/controllers/rezept.controller";
import { escapeHtml, formatDate } from "@/lib/utils";
import type { Patient, Behandlung, Untersuchung, Zahlung } from "@/models/types";
import {
    formatZahlungBezugLine,
    zahlStatusDisplay,
    zahlungsartLabel,
} from "@/lib/zahlung-buchung";

function rezeptStatusLabel(status: string): string {
    const s = status.trim();
    if (s === "AUSGESTELLT") return "Ausgestellt";
    if (s === "ENTWURF") return "Entwurf";
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

/** Datenpaket für Export gemäß Einstellungen › Export & Druck (PDF/CSV/JSON/XML). */
export type ClinicalDocumentExportBundle = {
    /** Zeilen für PDF-Renderer (`preview_document_pdf`). */
    pdfBodyLines: string[];
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

/** @deprecated Nutze suggestAttestExportBasename */
export function suggestAttestHtmlFilename(a: Attest): string {
    return `${suggestAttestExportBasename(a)}.html`;
}

/** @deprecated Nutze suggestRezeptExportBasename */
export function suggestRezeptHtmlFilename(r: Rezept): string {
    return `${suggestRezeptExportBasename(r)}.html`;
}

/** @deprecated Nutze suggestRezeptComboExportBasename */
export function suggestRezeptComboHtmlFilename(items: Rezept[]): string {
    return `${suggestRezeptComboExportBasename(items)}.html`;
}

/** @deprecated Nutze suggestQuittungExportBasename */
export function suggestQuittungHtmlFilename(z: Zahlung): string {
    return `${suggestQuittungExportBasename(z)}.html`;
}

function attestPdfLines(a: Attest, patient: Patient | null): string[] {
    const lines: string[] = [
        a.typ,
        "",
        `Patient: ${patient?.name ?? a.patient_id}`,
        patient ? `Geburtsdatum: ${formatDate(patient.geburtsdatum)}` : "",
        `Gültig: ${formatDate(a.gueltig_von)} – ${formatDate(a.gueltig_bis)}`,
        `Ausgestellt: ${formatDate(a.ausgestellt_am)}`,
        "",
        "---",
        "",
        ...a.inhalt.split(/\r?\n/),
        "",
        "---",
        "",
        "Unterschrift Ärztin/Arzt",
    ];
    return lines.map((s) => s.trimEnd());
}

export function bundleAttestExport(a: Attest, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfBodyLines = attestPdfLines(a, patient);
    const geb = patient ? formatDate(patient.geburtsdatum) : "";
    const csvText =
        `${csvRow(["Typ", "PatientId", "PatientName", "Geburtsdatum", "GueltigVon", "GueltigBis", "Ausgestellt", "Inhalt"])}\n`
        + `${csvRow([
            a.typ,
            a.patient_id,
            patient?.name ?? "",
            geb,
            formatDate(a.gueltig_von),
            formatDate(a.gueltig_bis),
            formatDate(a.ausgestellt_am),
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
    return { pdfBodyLines, csvText, jsonText, xmlText };
}

function rezeptPdfLinesSingle(r: Rezept, patient: Patient | null): string[] {
    return [
        "Rezept",
        "",
        `Patient: ${patient?.name ?? ""}`,
        patient ? `Geburtsdatum: ${formatDate(patient.geburtsdatum)}` : "",
        `Ausgestellt: ${formatDate(r.ausgestellt_am)}`,
        `Status: ${rezeptStatusLabel(r.status)}`,
        "",
        `Medikament: ${r.medikament}`,
        `Wirkstoff: ${(r.wirkstoff ?? "").trim() || "—"}`,
        `Dosierung: ${r.dosierung}`,
        `Dauer: ${r.dauer}`,
        `Hinweise: ${(r.hinweise ?? "").trim() || "—"}`,
        "",
        "---",
        "",
        "Unterschrift Ärztin/Arzt",
    ];
}

export function bundleRezeptExport(r: Rezept, patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfBodyLines = rezeptPdfLinesSingle(r, patient);
    const csvText =
        `${csvRow(["Medikament", "Wirkstoff", "Dosierung", "Dauer", "Hinweise", "Ausgestellt", "Status", "Patient", "Geburtsdatum"])}\n`
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
    return { pdfBodyLines, csvText, jsonText, xmlText };
}

function rezeptPdfLinesCombo(items: Rezept[], patient: Patient | null): string[] {
    if (items.length === 0) return ["Keine Rezeptdaten."];
    const first = items[0]!;
    const title = items.length === 1 ? "Rezept" : `Kombinationsrezept (${items.length})`;
    const lines: string[] = [
        title,
        "",
        `Patient: ${patient?.name ?? ""}`,
        patient ? `Geburtsdatum: ${formatDate(patient.geburtsdatum)}` : "",
        `Datum: ${formatDate(first.ausgestellt_am)}`,
        "",
        "---",
        "",
    ];
    for (let i = 0; i < items.length; i++) {
        const r = items[i]!;
        lines.push(`Position ${i + 1}`, "");
        lines.push(`Medikament: ${r.medikament}`, `Dosierung: ${r.dosierung}`, `Dauer: ${r.dauer}`);
        if ((r.wirkstoff ?? "").trim()) lines.push(`Wirkstoff: ${r.wirkstoff}`);
        if ((r.hinweise ?? "").trim()) lines.push(`Hinweise: ${r.hinweise}`);
        lines.push("");
    }
    lines.push("---", "", "Unterschrift Ärztin/Arzt");
    return lines;
}

export function bundleRezepteComboExport(items: Rezept[], patient: Patient | null): ClinicalDocumentExportBundle {
    const pdfBodyLines = rezeptPdfLinesCombo(items, patient);
    const header = csvRow(["Pos", "Medikament", "Wirkstoff", "Dosierung", "Dauer", "Hinweise", "Ausgestellt", "Status"]);
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
    return { pdfBodyLines, csvText, jsonText, xmlText };
}

function quittungPdfLines(z: Zahlung, patient: Patient, behandlungen: Behandlung[], untersuchungen: Untersuchung[]): string[] {
    const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen);
    return [
        "Zahlungsbeleg / Quittung",
        "",
        `Patient: ${patient.name}`,
        `Geburtsdatum: ${formatDate(patient.geburtsdatum)}`,
        `Zahlungsdatum: ${formatDate(z.created_at)}`,
        `Betrag: ${z.betrag.toFixed(2)} EUR`,
        `Zahlungsart: ${zahlungsartLabel(z.zahlungsart)}`,
        `Status: ${zahlStatusDisplay(z.status).label}`,
        `Zuordnung: ${bezugLine}`,
        `Beschreibung: ${(z.beschreibung ?? "").trim() || "—"}`,
        "",
        "Aus MeDoc exportiert.",
    ];
}

export function bundleQuittungExport(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): ClinicalDocumentExportBundle {
    const pdfBodyLines = quittungPdfLines(z, patient, behandlungen, untersuchungen);
    const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen);
    const csvText =
        `${csvRow(["Patient", "Geburtsdatum", "Zahlungsdatum", "BetragEUR", "Zahlungsart", "Status", "Zuordnung", "Beschreibung"])}\n`
        + `${csvRow([
            patient.name,
            formatDate(patient.geburtsdatum),
            formatDate(z.created_at),
            z.betrag.toFixed(2),
            zahlungsartLabel(z.zahlungsart),
            zahlStatusDisplay(z.status).label,
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
    return { pdfBodyLines, csvText, jsonText, xmlText };
}

export function buildAttestPrintHtml(a: Attest, patient: Patient | null): string {
    const title = escapeHtml(`Attest ${a.id}`);
    const typ = escapeHtml(a.typ);
    const patientLine = escapeHtml(patient?.name ?? a.patient_id);
    const geb = patient ? escapeHtml(formatDate(patient.geburtsdatum)) : "";
    const span = `${escapeHtml(formatDate(a.gueltig_von))} – ${escapeHtml(formatDate(a.gueltig_bis))}`;
    const aus = escapeHtml(formatDate(a.ausgestellt_am));
    const bodyHtml = escapeHtml(a.inhalt);
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>${title}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt}.row{margin:0.3cm 0}.label{display:inline-block;width:4cm;color:#555}
            .body{margin:1cm 0;white-space:pre-wrap}</style></head><body>
            <h1>${typ}</h1>
            <div class="row"><span class="label">Patient:</span>${patientLine}</div>
            <div class="row"><span class="label">Geburtsdatum:</span>${geb}</div>
            <div class="row"><span class="label">Gültig:</span>${span}</div>
            <div class="row"><span class="label">Ausgestellt:</span>${aus}</div>
            <hr/>
            <div class="body">${bodyHtml}</div>
            <p style="margin-top:3cm">______________________<br/>Unterschrift Ärztin/Arzt</p>
            </body></html>`;
}

function rezeptSectionBlock(r: Rezept): string {
    return `<section class="rx">
            <div class="row"><span class="label">Medikament:</span><strong>${escapeHtml(r.medikament)}</strong></div>
            ${r.wirkstoff?.trim() ? `<div class="row"><span class="label">Wirkstoff:</span>${escapeHtml(r.wirkstoff)}</div>` : ""}
            <div class="row"><span class="label">Dosierung:</span>${escapeHtml(r.dosierung)}</div>
            <div class="row"><span class="label">Dauer:</span>${escapeHtml(r.dauer)}</div>
            ${r.hinweise?.trim() ? `<div class="row"><span class="label">Hinweise:</span>${escapeHtml(r.hinweise)}</div>` : ""}
        </section>`;
}

/** Ein Rezept — Tabellenlayout (Akte / kompakte Ansicht). */
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
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>Rezept</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#111;line-height:1.45}
              h1{font-size:20px;margin:0 0 16px}
              table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;vertical-align:top}
              th{background:#f4f4f4;font-weight:600;width:34%}
              .muted{color:#555;font-size:11px;margin-top:28px}
            </style></head><body>
            <h1>Rezept</h1>
            <table aria-label="Rezept Stammdaten">
              <tbody>
                <tr><th scope="row">Patient</th><td>${patientLine}</td></tr>
                <tr><th scope="row">Geburtsdatum</th><td>${geb}</td></tr>
                <tr><th scope="row">Ausgestellt am</th><td>${aus}</td></tr>
                <tr><th scope="row">Status</th><td>${statusLabel}</td></tr>
                <tr><th scope="row">Medikament</th><td>${med}</td></tr>
                <tr><th scope="row">Wirkstoff</th><td>${wirk}</td></tr>
                <tr><th scope="row">Dosierung</th><td>${dos}</td></tr>
                <tr><th scope="row">Dauer</th><td>${dauer}</td></tr>
                <tr><th scope="row">Hinweise</th><td>${hin}</td></tr>
              </tbody>
            </table>
            <p style="margin-top:48px">______________________<br/><span style="font-size:12px">Unterschrift Ärztin/Arzt</span></p>
            <p class="muted">Aus MeDoc gedruckt.</p>
            </body></html>`;
}

/** Mehrere Rezepte auf einem Ausdruck (Rezeptübersicht). */
export function buildRezepteComboPrintHtml(items: Rezept[], patient: Patient | null): string {
    if (items.length === 0) {
        return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>Rezept</title></head><body><p>Keine Rezeptdaten.</p></body></html>`;
    }
    const first = items[0]!;
    const title = items.length === 1 ? "Rezept" : `Kombinationsrezept (${items.length})`;
    const datum = formatDate(first.ausgestellt_am);
    const patientLine = escapeHtml(patient?.name ?? "");
    const geb = patient ? escapeHtml(formatDate(patient.geburtsdatum)) : "";
    const body = items.map(rezeptSectionBlock).join("");
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt;margin-bottom:0.4cm}h2{font-size:13pt;margin:0.4cm 0 0.2cm;color:#333}
            .row{margin:0.25cm 0}.label{display:inline-block;width:4cm;color:#555}
            .rx{border-top:1px solid #ddd;padding-top:0.4cm;margin-top:0.4cm}
            .rx:first-of-type{border-top:none;margin-top:0;padding-top:0}</style>
            </head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="row"><span class="label">Patient:</span>${patientLine}</div>
            <div class="row"><span class="label">Geburtsdatum:</span>${geb}</div>
            <div class="row"><span class="label">Datum:</span>${escapeHtml(datum)}</div>
            <hr/>
            ${body}
            <p style="margin-top:3cm">______________________<br/>Unterschrift Ärztin/Arzt</p>
            </body></html>`;
}

export function buildQuittungPrintHtml(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): string {
    const bezugLine = escapeHtml(formatZahlungBezugLine(z, behandlungen, untersuchungen));
    const art = escapeHtml(zahlungsartLabel(z.zahlungsart));
    const stat = escapeHtml(zahlStatusDisplay(z.status).label);
    const bet = escapeHtml(`${z.betrag.toFixed(2)} EUR`);
    const quando = escapeHtml(formatDate(z.created_at));
    const beschr = escapeHtml((z.beschreibung ?? "").trim() || "—");
    const pname = escapeHtml(patient.name);
    const geb = escapeHtml(formatDate(patient.geburtsdatum));
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>Quittung</title>
            <style>
              body{font-family:Helvetica,Arial,sans-serif;padding:28px;color:#111;line-height:1.45}
              h1{font-size:18px;margin:0 0 6px}
              table{border-collapse:collapse;width:100%;margin:18px 0;font-size:13px}
              th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
              th{background:#f4f4f4;width:38%}
              .muted{color:#555;font-size:11px;margin-top:24px}
            </style></head><body>
            <h1>Zahlungsbeleg / Quittung</h1>
            <table>
              <tbody>
                <tr><th scope="row">Patient</th><td>${pname}</td></tr>
                <tr><th scope="row">Geburtsdatum</th><td>${geb}</td></tr>
                <tr><th scope="row">Zahlungsdatum</th><td>${quando}</td></tr>
                <tr><th scope="row">Betrag</th><td><strong>${bet}</strong></td></tr>
                <tr><th scope="row">Zahlungsart</th><td>${art}</td></tr>
                <tr><th scope="row">Status</th><td>${stat}</td></tr>
                <tr><th scope="row">Zuordnung</th><td>${bezugLine}</td></tr>
                <tr><th scope="row">Beschreibung</th><td>${beschr}</td></tr>
              </tbody>
            </table>
            <p class="muted">Aus MeDoc gedruckt.</p>
            </body></html>`;
}
