/**
 * Structured PDF layout payloads for the Rust renderer (`clinical_pdf_layout.rs`).
 * Matches German reference layouts (Attest, Rezept, Patientenquittung).
 */

import type { Attest } from "@/systems/practice-host/controllers/attest.controller";
import type { Rezept } from "@/systems/practice-host/controllers/rezept.controller";
import type { Patient, Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { translateLocale, translateLocaleParams, useLocale } from "@/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { buildClinicalTemplateKopfLines } from "@/lib/clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1, type PraxisFieldKey } from "@/lib/document-template-schema";
import { loadPraxisHeaderPrivacy } from "@/lib/praxis-header-privacy";
import { formatZahlungBezugLine, zahlStatusDisplay, zahlungsartLabel } from "@/lib/zahlung-buchung";

const docT = (key: string) => translateLocale(useLocale.getState().locale, key);
const docTp = (key: string, params: Record<string, string | number>) =>
    translateLocaleParams(useLocale.getState().locale, key, params);

const KOPF_FIELDS: PraxisFieldKey[] = [
    "name",
    "address",
    "phone",
    "email",
    "behandler",
    "zanr",
    "bsnr",
    "bank",
];

export type ClinicalPdfLayout = {
    kind: string;
    praxisLines: string[];
    /** Contact lines top right (Attest reference layout). */
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
        /** Rust column widths: `quittung` | `rezept` | `rezept_combo` */
        columnLayout?: string | null;
    }[];
    detailRecords: { art: string; zeitraum: string; details: string[] }[];
    totals: { label: string; value: string }[];
    closingParagraphs: string[];
    signatureLines: string[];
    /** Meta unten rechts (Attest: Ausstellungsdatum, Nummer). */
    footerMetaLines?: { label: string; value: string }[];
};

function headerContactRightFromPraxis(): string[] {
    const p = getInvoicePraxisFromStorage();
    const out: string[] = [];
    const tel = (p.telefon ?? "").trim();
    const fax = (p.fax ?? "").trim();
    const mail = (p.email ?? "").trim();
    if (tel) out.push(`${docT("document.print.phone")}: ${tel}`);
    if (fax) out.push(`${docT("document.print.fax")}: ${fax}`);
    if (mail) out.push(`${docT("document.print.email")}: ${mail}`);
    return out;
}

function praxisLinesForPdf(): string[] {
    const praxis = getInvoicePraxisFromStorage();
    const tpl = emptyDocumentTemplatePayloadV1();
    tpl.kopf.fieldsToShow = KOPF_FIELDS;
    return buildClinicalTemplateKopfLines(tpl, praxis, loadPraxisHeaderPrivacy());
}

function formatVerordnungsdatumDe(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

function signatureLines(): string[] {
    const p = getInvoicePraxisFromStorage();
    const bh = (p.behandler_name ?? "").trim();
    const beruf = (p.berufsbezeichnung ?? "").trim();
    const zanr = (p.zanr ?? "").trim();
    const bsnr = (p.bsnr ?? "").trim();
    if (!bh) return [];
    const out = [bh];
    if (beruf) out.push(beruf);
    if (zanr || bsnr) out.push(`ZANR: ${zanr || "-"} / BSNR: ${bsnr || "-"}`);
    out.push("(Stempel / Unterschrift)");
    return out;
}

export function buildAttestPdfLayout(a: Attest, patient: Patient | null): ClinicalPdfLayout {
    const von = formatDate(a.gueltig_von);
    const bis = formatDate(a.gueltig_bis);
    const ausgestellt = formatDate(a.ausgestellt_am);
    const t0 = new Date(`${a.gueltig_von.slice(0, 10)}T12:00:00`);
    const t1 = new Date(`${a.gueltig_bis.slice(0, 10)}T12:00:00`);
    const days = Math.max(1, Math.round((t1.getTime() - t0.getTime()) / 86_400_000) + 1);
    const erstFolge =
        (a.erst_oder_folge ?? "ERST") === "FOLGE" ? "Folgebescheinigung" : "Erstbescheinigung";
    const pname = patient?.name ?? a.patient_id;
    const geb = patient ? formatDate(patient.geburtsdatum) : "—";
    const icd = (a.icd10_code ?? "").trim() || "—";

    const intro = [
        `Hiermit wird bescheinigt, dass sich ${pname}${patient ? `, geboren am ${geb},` : ""} in ärztlicher Behandlung befindet.`,
    ];

    const labelValueRows: { label: string; value: string }[] = [
        { label: "Art der Bescheinigung", value: `${a.typ} (${erstFolge})` },
        {
            label: "Gültigkeitszeitraum",
            value: `${von} bis ${bis} (${days} Kalendertag${days === 1 ? "" : "e"})`,
        },
        { label: "Diagnose (ICD-10)", value: icd },
    ];
    if (a.typ.toLowerCase().includes("arbeitsunfähig") && (a.arbeitgeber ?? "").trim()) {
        labelValueRows.push({ label: "Arbeitgeber", value: a.arbeitgeber!.trim() });
    }

    const befund = a.inhalt.split(/\r?\n/).map((s) => s.trimEnd()).filter((s) => s.length > 0);
    const befundText = befund.join("\n").trim();
    const labelRows = [...labelValueRows];
    if (befundText) {
        labelRows.unshift({ label: "Befund / Angaben", value: befundText });
    }
    labelRows.push({ label: "Ort, Datum", value: "________________________________________" });

    return {
        kind: "attest",
        praxisLines: praxisLinesForPdf(),
        headerRightLines: headerContactRightFromPraxis(),
        metaLines: [],
        addressLines: [],
        documentTitle: "ÄRZTLICHES ATTEST",
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
            { label: "Ausstellungsdatum", value: ausgestellt },
            { label: "Attest-Nr.", value: a.id.slice(0, 8).toUpperCase() },
        ],
    };
}

export function buildRezeptPdfLayout(r: Rezept, patient: Patient | null): ClinicalPdfLayout {
    const typ = (r.rezept_typ ?? "PRIVAT").trim() || "PRIVAT";
    const autIdem = r.aut_idem !== false;
    const left: string[] = [
        `Name: ${patient?.name ?? "—"}`,
        patient ? `Geburtsdatum: ${formatDate(patient.geburtsdatum)}` : "",
        patient?.versicherungsnummer ? `Vers.-Nr.: ${patient.versicherungsnummer}` : "",
    ].filter(Boolean);
    const right: string[] = [
        patient?.adresse?.trim() ? patient.adresse.trim().replace(/\n/g, ", ") : "",
    ].filter(Boolean);

    return {
        kind: "rezept",
        praxisLines: praxisLinesForPdf(),
        metaLines: [
            { label: "Rezeptnummer", value: r.id.slice(0, 8).toUpperCase() },
            { label: "Verschreibungsdatum", value: formatVerordnungsdatumDe(r.ausgestellt_am) },
            { label: "Rezepttyp", value: typ },
        ],
        addressLines: [],
        documentTitle: "REZEPT",
        documentSubtitle: `Verschreibung (${typ})`,
        introParagraphs: [],
        twoColumn: {
            leftTitle: "Patient/in",
            leftLines: left,
            rightTitle: "Adresse",
            rightLines: right.length > 0 ? right : ["—"],
        },
        tables: [
            {
                title: "Rp. — Verschriebene Medikamente",
                columnLayout: "rezept",
                headers: ["Medikament", "Dosierung", "Dauer", "PZN", "Hinweis"],
                rows: [
                    [
                        r.medikament,
                        r.dosierung,
                        r.dauer,
                        (r.pzn ?? "").trim() || "—",
                        (r.hinweise ?? "").trim() || "—",
                    ],
                    [
                        (r.wirkstoff ?? "").trim() || "—",
                        (r.darreichungsform ?? "").trim() || "—",
                        (r.packungsgroesse ?? "").trim() || "—",
                        r.menge != null ? String(r.menge) : "—",
                        autIdem ? "aut idem" : "Austausch möglich",
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

export function buildRezeptComboPdfLayout(items: Rezept[], patient: Patient | null): ClinicalPdfLayout {
    const first = items[0]!;
    const rows = items.map((r, i) => [
        String(i + 1),
        r.medikament,
        r.dosierung,
        r.dauer,
        (r.pzn ?? "").trim() || "—",
    ]);
    return {
        kind: "rezept",
        praxisLines: praxisLinesForPdf(),
        metaLines: [
            { label: "Datum", value: formatVerordnungsdatumDe(first.ausgestellt_am) },
            { label: "Positionen", value: String(items.length) },
        ],
        addressLines: [],
        documentTitle: "KOMBINATIONSREZEPT",
        documentSubtitle: `${items.length} Medikamente`,
        introParagraphs: [],
        twoColumn: patient
            ? {
                  leftTitle: "Patient/in",
                  leftLines: [
                      `Name: ${patient.name}`,
                      `Geburtsdatum: ${formatDate(patient.geburtsdatum)}`,
                      patient.versicherungsnummer ? `Vers.-Nr.: ${patient.versicherungsnummer}` : "",
                  ].filter(Boolean),
                  rightTitle: "Adresse",
                  rightLines: patient.adresse?.trim()
                      ? [patient.adresse.trim().replace(/\n/g, ", ")]
                      : ["—"],
              }
            : null,
        tables: [
            {
                title: "Rp.",
                columnLayout: "rezept_combo",
                headers: ["Pos.", "Medikament", "Dosierung", "Dauer", "PZN"],
                rows,
            },
        ],
        detailRecords: [],
        totals: [],
        closingParagraphs: [],
        signatureLines: signatureLines(),
    };
}

export function buildQuittungPdfLayout(
    z: Zahlung,
    patient: Patient,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    receiptNumber: string,
): ClinicalPdfLayout {
    const bezug = formatZahlungBezugLine(z, behandlungen, untersuchungen, docT, docTp);
    const praxis = getInvoicePraxisFromStorage();
    const ust =
        (praxis.ust_befreiung_hinweis ?? "").trim() || "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG";

    const payDate = formatDate(z.created_at);

    return {
        kind: "quittung",
        praxisLines: praxisLinesForPdf(),
        metaLines: [
            { label: "Quittung-Nr.", value: receiptNumber },
            { label: "Zahlungsdatum", value: payDate },
        ],
        addressLines: [patient.name, ...(patient.adresse?.trim() ? [patient.adresse.trim()] : [])],
        documentTitle: "PATIENTENQUITTUNG",
        documentSubtitle: `für ${patient.name}`,
        introParagraphs: [`Abgerechnete Leistung für ${payDate}`],
        labelValueRows: [
            { label: "Patient/in", value: patient.name },
            { label: "Geburtsdatum", value: formatDate(patient.geburtsdatum) },
            ...(patient.versicherungsnummer
                ? [{ label: "Versicherungsnummer", value: patient.versicherungsnummer }]
                : []),
        ],
        twoColumn: null,
        tables: [
            {
                title: null,
                columnLayout: "quittung",
                headers: ["Tag", "Position", "Kurzbeschreibung"],
                rows: [[payDate, receiptNumber, bezug]],
            },
        ],
        detailRecords: [],
        totals: [
            { label: "Sachkosten", value: "0,00 €" },
            { label: "Honorar", value: formatCurrency(z.betrag) },
            { label: "Gesamt", value: formatCurrency(z.betrag) },
        ],
        closingParagraphs: [
            `Zahlungsart: ${zahlungsartLabel(z.zahlungsart, docT)} · Status: ${zahlStatusDisplay(z.status, docT).label}`,
            ust,
            ...(z.zahlungsart === "BAR" || z.zahlungsart === "KARTE" ? ["Betrag dankend erhalten."] : []),
            ...((z.beschreibung ?? "").trim() ? [(z.beschreibung ?? "").trim()] : []),
        ],
        signatureLines: signatureLines(),
    };
}
