import type { Bilanz, StatistikOverview, Zahlung } from "@/models/types";
import type { BilanzSnapshot } from "@/systems/practice-host/controllers/bilanz-snapshot.controller";
import type { Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import type {
    DSFA,
    LogRetentionReport,
    VVT,
} from "@/systems/practice-host/controllers/compliance.controller";
import {
    buildInvoiceHeaderAddressLinesForExport,
    getInvoicePraxisFromStorage,
} from "@/lib/invoice-leistung";
import { finishExportWithSettings } from "@/lib/export";
import { renderReportPdf, type ReportPdfInput } from "@/systems/practice-host/controllers/report.controller";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { parseDelimitedGrid } from "@/lib/export-delimited";

export type ReportExportFormat = "pdf" | "csv" | "json" | "xml";

export interface ReportSummaryRow {
    label: string;
    value: string;
}

export interface ReportSection {
    title: string;
    headers: string[];
    rows: string[][];
}

/** Shared bundle for Statistik, Bilanz, and other tabular practice reports. */
export interface ReportBundle {
    docTitle: string;
    exportTitle: string;
    hint: string;
    suggestedBasename: string;
    generatedAt: string;
    summary: ReportSummaryRow[];
    sections: ReportSection[];
}

function escapeCsvCell(v: string | number): string {
    return `"${String(v).replace(/"/g, '""')}"`;
}

function practiceContext(): { practiceName: string; practiceAddress: string[] } {
    const praxis = getInvoicePraxisFromStorage();
    return {
        practiceName: praxis.name?.trim() || "Zahnarztpraxis",
        practiceAddress: buildInvoiceHeaderAddressLinesForExport(praxis),
    };
}

function toReportPdfInput(bundle: ReportBundle): ReportPdfInput {
    const ctx = practiceContext();
    return {
        docTitle: bundle.docTitle,
        generatedAt: bundle.generatedAt,
        practiceName: ctx.practiceName,
        practiceAddress: ctx.practiceAddress,
        summary: bundle.summary.map((r) => ({ label: r.label, value: r.value })),
        sections: bundle.sections.map((s) => ({
            title: s.title,
            headers: s.headers,
            rows: s.rows,
        })),
    };
}

export function reportBundleToCsv(bundle: ReportBundle): string {
    const rows: (string | number)[][] = [["Sektion", "Kennzahl", "Wert"]];
    for (const r of bundle.summary) {
        rows.push(["Zusammenfassung", r.label, r.value]);
    }
    for (const sec of bundle.sections) {
        for (const row of sec.rows) {
            const key = row[0] ?? "";
            const rest = row.slice(1);
            const value =
                rest.length === 0
                    ? key
                    : rest.length === 1
                      ? rest[0]!
                      : sec.headers
                            .slice(1)
                            .map((h, i) => `${h}: ${rest[i] ?? ""}`)
                            .join(" · ");
            const label =
                sec.headers.length > 0 && rest.length > 0
                    ? `${sec.headers[0]}: ${key}`
                    : key;
            rows.push([sec.title, label, value]);
        }
    }
    return `\uFEFF${rows.map((r) => r.map(escapeCsvCell).join(";")).join("\n")}`;
}

export function reportBundleToJson(bundle: ReportBundle): string {
    return JSON.stringify(
        {
            version: 1,
            docTitle: bundle.docTitle,
            generatedAt: bundle.generatedAt,
            summary: bundle.summary,
            sections: bundle.sections,
        },
        null,
        2,
    );
}

function xmlEscape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function reportBundleToXml(bundle: ReportBundle): string {
    const summaryXml = bundle.summary
        .map((r) => `    <row label="${xmlEscape(r.label)}" value="${xmlEscape(r.value)}" />`)
        .join("\n");
    const sectionsXml = bundle.sections
        .map((sec) => {
            const headerXml = sec.headers.map((h) => `      <col>${xmlEscape(h)}</col>`).join("\n");
            const rowsXml = sec.rows
                .map((row) => {
                    const cells = row.map((c) => `        <cell>${xmlEscape(c)}</cell>`).join("\n");
                    return `      <row>\n${cells}\n      </row>`;
                })
                .join("\n");
            return `  <section title="${xmlEscape(sec.title)}">\n    <headers>\n${headerXml}\n    </headers>\n    <rows>\n${rowsXml}\n    </rows>\n  </section>`;
        })
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<medocReport version="1" title="${xmlEscape(bundle.docTitle)}" generatedAt="${xmlEscape(bundle.generatedAt)}">\n  <summary>\n${summaryXml}\n  </summary>\n${sectionsXml}\n</medocReport>`;
}

export function reportFilename(bundle: ReportBundle, format: ReportExportFormat): string {
    const ext = format;
    const base = bundle.suggestedBasename.replace(/\.(pdf|csv|json|xml)$/i, "");
    return `${base}.${ext}`;
}

export async function exportReportBundle(bundle: ReportBundle, format: ReportExportFormat): Promise<void> {
    const filename = reportFilename(bundle, format);
    if (format === "pdf") {
        const bytes = await renderReportPdf(toReportPdfInput(bundle));
        await finishExportWithSettings({
            format: "pdf",
            title: bundle.exportTitle,
            hint: bundle.hint,
            suggestedFilename: filename,
            mime: "application/pdf",
            binaryBody: bytes,
        });
        return;
    }
    if (format === "csv") {
        await finishExportWithSettings({
            format: "csv",
            title: bundle.exportTitle,
            hint: bundle.hint,
            suggestedFilename: filename,
            mime: "text/csv;charset=utf-8",
            textBody: reportBundleToCsv(bundle),
        });
        return;
    }
    if (format === "json") {
        await finishExportWithSettings({
            format: "json",
            title: bundle.exportTitle,
            hint: bundle.hint,
            suggestedFilename: filename,
            mime: "application/json;charset=utf-8",
            textBody: reportBundleToJson(bundle),
        });
        return;
    }
    await finishExportWithSettings({
        format: "xml",
        title: bundle.exportTitle,
        hint: bundle.hint,
        suggestedFilename: filename,
        mime: "application/xml;charset=utf-8",
        textBody: reportBundleToXml(bundle),
    });
}

type Period = "6m" | "12m";

function periodLabel(period: Period): string {
    return period === "6m" ? "Letzte 6 Monate" : "Letzte 12 Monate";
}

function todayDe(): string {
    return new Date().toLocaleDateString("de-DE");
}

/** Statistik page — full overview including Einnahmen (income) section. */
export function buildStatistikReportBundle(stats: StatistikOverview, period: Period): ReportBundle {
    const pl = periodLabel(period);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const detailRows: string[][] = [];
    detailRows.push(["Patienten gesamt", String(stats.patienten_gesamt)]);
    detailRows.push(["Produkte unter Mindestbestand", String(stats.produkte_niedrig)]);
    detailRows.push(["Einnahmen Kalendermonat (laufend)", formatCurrency(stats.einnahmen_aktueller_monat)]);
    for (const m of stats.patienten_neu_pro_monat) {
        detailRows.push([`Neue Patienten ${m.month}`, String(m.value)]);
    }
    for (const m of stats.einnahmen_pro_monat) {
        detailRows.push([`Einnahmen ${m.month}`, formatCurrency(m.value)]);
    }
    for (const m of stats.termine_pro_monat) {
        detailRows.push([`Termine ${m.month}`, String(m.value)]);
    }
    for (const m of stats.behandlungen_pro_monat) {
        detailRows.push([`Behandlungen ${m.month}`, String(m.value)]);
    }
    for (const m of stats.bestellungen_pro_monat) {
        detailRows.push([`Bestellungen ${m.month}`, String(m.value)]);
    }
    for (const v of stats.altersgruppen) {
        detailRows.push([`Altersgruppe ${v.label}`, String(v.value)]);
    }
    for (const v of stats.geschlechter) {
        detailRows.push([`Geschlecht ${v.label}`, String(v.value)]);
    }
    for (const v of stats.behandlungen_nach_kategorie) {
        detailRows.push([`Behandlungskategorie ${v.label}`, String(v.value)]);
    }
    for (const v of stats.krankheitsbilder_top ?? []) {
        detailRows.push([`Krankheitsbild ${v.label}`, String(v.value)]);
    }
    for (const m of stats.krankheitsbilder_verlauf_pro_monat ?? []) {
        detailRows.push([`Krankheitsbild-Verlauf ${m.month}`, String(m.value)]);
    }
    for (const v of stats.medikamente_top) {
        detailRows.push([`Top-Wirkstoff ${v.label}`, String(v.value)]);
    }
    for (const v of stats.termin_status) {
        detailRows.push([`Termin-Status ${v.label}`, String(v.value)]);
    }
    for (const v of stats.termin_art) {
        detailRows.push([`Termin-Art ${v.label}`, String(v.value)]);
    }
    for (const v of stats.bestellungen_nach_status) {
        detailRows.push([`Bestell-Status ${v.label}`, String(v.value)]);
    }

    const einnahmenRows = stats.einnahmen_pro_monat.map((m) => [m.month, formatCurrency(m.value)]);
    const zahlungsartRows = stats.umsatz_nach_zahlungsart.map((v) => [v.label, formatCurrency(v.value)]);

    return {
        docTitle: "Statistik — Einnahmen & Praxisauswertung",
        exportTitle: "Statistik exportieren",
        hint: `${pl} · PDF, CSV, JSON oder XML — gleicher Druck-Backend wie Akte und Rechnung.`,
        suggestedBasename: `medoc-statistik-${period}-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Zeitraum", value: pl },
            { label: "Einnahmen (Kalendermonat)", value: formatCurrency(stats.einnahmen_aktueller_monat) },
            { label: "Patienten gesamt", value: String(stats.patienten_gesamt) },
        ],
        sections: [
            {
                title: "Einnahmen pro Monat",
                headers: ["Monat", "Betrag"],
                rows: einnahmenRows,
            },
            {
                title: "Umsatz nach Zahlungsart",
                headers: ["Zahlungsart", "Betrag"],
                rows: zahlungsartRows,
            },
            {
                title: "Detailkennzahlen",
                headers: ["Kennzahl", "Wert"],
                rows: detailRows,
            },
        ],
    };
}

/** Bilanz page — income / outstanding / monthly breakdown. */
export function buildBilanzReportBundle(
    bilanz: Bilanz,
    byMonth: Array<[string, { einnahmen: number; ausstehend: number; storniert: number }]>,
    snapshots: BilanzSnapshot[],
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const monthRows = byMonth.map(([month, v]) => [
        month,
        formatCurrency(v.einnahmen),
        formatCurrency(v.ausstehend),
        formatCurrency(v.storniert),
    ]);
    const snapRows = snapshots.map((s) => [
        s.label,
        formatCurrency(s.einnahmen_cents / 100),
        formatCurrency(s.ausgaben_cents / 100),
        formatCurrency(s.saldo_cents / 100),
    ]);

    return {
        docTitle: "Bilanz — Einnahmenbericht",
        exportTitle: "Bilanz exportieren",
        hint: "Einnahmen, Ausstehend, Monatsverlauf und Snapshots — PDF mit Praxis-Briefkopf.",
        suggestedBasename: `medoc-bilanz-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Einnahmen (bezahlt)", value: formatCurrency(bilanz.einnahmen) },
            { label: "Ausstehend", value: formatCurrency(bilanz.ausstehend) },
            { label: "Storniert", value: formatCurrency(bilanz.storniert) },
            { label: "Anzahl Zahlungen", value: String(bilanz.anzahl_zahlungen) },
        ],
        sections: [
            {
                title: "Monatlicher Verlauf (letzte 12 Monate)",
                headers: ["Monat", "Einnahmen", "Ausstehend", "Storniert"],
                rows: monthRows,
            },
            ...(snapRows.length > 0
                ? [
                      {
                          title: "Gespeicherte Bilanz-Snapshots",
                          headers: ["Label", "Einnahmen", "Ausgaben", "Saldo"],
                          rows: snapRows,
                      },
                  ]
                : []),
        ],
    };
}

export type FinanzTxRow =
    | { kind: "zahlung"; z: Zahlung }
    | { kind: "bestellung"; b: Bestellung };

export interface FinanzKpiSnapshot {
    einnM: number;
    einnDeltaPct: number | null;
    st: number;
    offeneN: number;
    offeneSum: number;
    gew: number;
}

function zahlungsartLabelFin(art: string): string {
    const map: Record<string, string> = {
        BAR: "Bar",
        KARTE: "Karte",
        UEBERWEISUNG: "Überweisung",
        RECHNUNG: "Rechnung",
    };
    return map[art] ?? art;
}

function finanzVorgangText(z: Zahlung): string {
    const bezug = z.behandlung_id ? "Behandlung" : z.untersuchung_id ? "Untersuchung" : "Direktzahlung";
    const note = (z.beschreibung ?? "").trim();
    if (note) return bezug === "Direktzahlung" ? note : `${bezug} — ${note}`;
    return bezug;
}

/** Finanzen page — KPI summary + filtered transaction list. */
export function buildFinanzenReportBundle(
    rows: FinanzTxRow[],
    patientNames: Map<string, string>,
    kpi: FinanzKpiSnapshot,
    filterLabel: string,
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const txRows = rows.map((r) => {
        if (r.kind === "zahlung") {
            const z = r.z;
            return [
                formatDate(z.created_at),
                "Zahlung",
                finanzVorgangText(z),
                patientNames.get(z.patient_id) ?? "—",
                zahlungsartLabelFin(z.zahlungsart),
                z.status,
                formatCurrency(z.betrag),
            ];
        }
        const b = r.b;
        return [
            formatDate(b.created_at),
            "Bestellung",
            `Bestellung: ${b.artikel}`,
            b.lieferant,
            "—",
            b.status,
            b.gesamtbetrag != null && Number.isFinite(b.gesamtbetrag) ? formatCurrency(b.gesamtbetrag) : "—",
        ];
    });

    return {
        docTitle: "Finanzen — Transaktionsbericht",
        exportTitle: "Finanzen exportieren",
        hint: `${filterLabel} · PDF mit Praxis-Briefkopf oder CSV/JSON/XML.`,
        suggestedBasename: `medoc-finanzen-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Filter", value: filterLabel },
            { label: "Einnahmen MTD", value: formatCurrency(kpi.einnM) },
            { label: "Storni MTD", value: formatCurrency(kpi.st) },
            { label: "Gewinn MTD (netto)", value: formatCurrency(kpi.gew) },
            { label: "Offene Posten", value: `${kpi.offeneN} (${formatCurrency(kpi.offeneSum)})` },
        ],
        sections: [
            {
                title: "Transaktionen",
                headers: ["Datum", "Typ", "Vorgang", "Gegenpartei", "Zahlungsart", "Status", "Betrag"],
                rows: txRows,
            },
        ],
    };
}

export type ComplianceReportKind = "vvt" | "dsfa" | "retention";

/** Compliance page — VVT, DSFA, or log-retention report. */
export function buildComplianceReportBundle(
    kind: ComplianceReportKind,
    data: VVT | DSFA | LogRetentionReport,
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (kind === "vvt") {
        const v = data as VVT;
        const sections = v.activities.map((a) => ({
            title: a.name,
            headers: ["Feld", "Inhalt"],
            rows: [
                ["Zweck", a.purpose],
                ["Rechtsgrundlage", a.legal_basis],
                ["Datenkategorien", a.data_categories.join("; ")],
                ["Betroffene", a.data_subjects.join("; ")],
                ["Empfänger", a.recipients.join("; ")],
                ["Aufbewahrung", a.retention],
                ["Technische Maßnahmen", a.technical_measures.join("; ")],
                ["Organisatorische Maßnahmen", a.organisational_measures.join("; ")],
            ],
        }));
        return {
            docTitle: "Verzeichnis der Verarbeitungstätigkeiten (VVT)",
            exportTitle: "Compliance-Bericht exportieren",
            hint: "Art. 30 DSGVO · PDF/CSV/JSON/XML — gleicher Renderer wie Finanzberichte.",
            suggestedBasename: `medoc-vvt-${dateStamp}`,
            generatedAt: formatDateTime(v.generated_at),
            summary: [
                { label: "Verantwortlicher", value: v.controller },
                { label: "System", value: v.system },
                { label: "Version", value: v.system_version },
            ],
            sections,
        };
    }
    if (kind === "dsfa") {
        const d = data as DSFA;
        const scenarioRows = d.scenarios.map((s, i) => [
            String(i + 1),
            s.threat,
            String(s.likelihood),
            String(s.impact),
            String(s.residual_risk),
            s.mitigations.join("; "),
        ]);
        return {
            docTitle: "Datenschutz-Folgenabschätzung (DSFA)",
            exportTitle: "Compliance-Bericht exportieren",
            hint: "Art. 35 DSGVO · PDF/CSV/JSON/XML.",
            suggestedBasename: `medoc-dsfa-${dateStamp}`,
            generatedAt: formatDateTime(d.generated_at),
            summary: [
                { label: "System", value: d.system },
                { label: "Version", value: d.system_version },
            ],
            sections: [
                {
                    title: "Beschreibung der Verarbeitung",
                    headers: ["Abschnitt", "Inhalt"],
                    rows: [["Überblick", d.processing_overview]],
                },
                {
                    title: "Notwendigkeit und Verhältnismäßigkeit",
                    headers: ["Abschnitt", "Inhalt"],
                    rows: [["Bewertung", d.necessity_proportionality]],
                },
                {
                    title: "Risikoszenarien",
                    headers: ["Nr.", "Bedrohung", "Wahrscheinlichkeit", "Auswirkung", "Restrisiko", "Maßnahmen"],
                    rows: scenarioRows,
                },
            ],
        };
    }
    const r = data as LogRetentionReport;
    return {
        docTitle: "Log-Retention — Ausführungsbericht",
        exportTitle: "Compliance-Bericht exportieren",
        hint: "Retention-Lauf · PDF/CSV/JSON/XML.",
        suggestedBasename: `medoc-retention-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Geprüfte Einträge", value: String(r.scanned) },
            { label: "Beibehalten", value: String(r.kept) },
            { label: "Gelöscht", value: String(r.deleted.length) },
            { label: "Fehler", value: String(r.errors.length) },
        ],
        sections: [
            ...(r.deleted.length > 0
                ? [
                      {
                          title: "Gelöschte Referenzen",
                          headers: ["ID"],
                          rows: r.deleted.map((id) => [id]),
                      },
                  ]
                : []),
            ...(r.errors.length > 0
                ? [
                      {
                          title: "Fehler",
                          headers: ["Meldung"],
                          rows: r.errors.map((e) => [e]),
                      },
                  ]
                : []),
        ],
    };
}

/** Audit log — parse backend CSV (RFC-4180) into report bundle for PDF/JSON/XML. */
export function buildAuditReportBundleFromCsv(csvText: string, totalHint?: number): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const { rows } = parseDelimitedGrid(csvText, ",");
    const dataRows = rows.length > 1 ? rows.slice(1) : [];
    const tableRows = dataRows.map((r) => [
        r[1] ?? "",
        r[3] ?? "",
        r[4] ?? "",
        r[6] ?? "",
        r[7] === "1" ? "Ja" : "Nein",
        r[2] ?? "",
    ]);
    return {
        docTitle: "Audit-Log — Vollständiger Export",
        exportTitle: "Audit-Log exportieren",
        hint: "Vollständiger Audit-Trail · PDF mit Praxis-Briefkopf oder CSV/JSON/XML.",
        suggestedBasename: `medoc-audit-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Einträge", value: String(totalHint ?? dataRows.length) },
            { label: "Exportumfang", value: "Vollständig (Backend)" },
        ],
        sections: [
            {
                title: "Audit-Einträge",
                headers: ["Zeitpunkt", "Aktion", "Entität", "Details", "Notfall", "Benutzer"],
                rows: tableRows,
            },
        ],
    };
}

/** Legacy comma-separated Finanzen CSV (Excel-compatible). */
export function finanzenTransactionsToLegacyCsv(
    rows: FinanzTxRow[],
    patientNames: Map<string, string>,
): string {
    const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const header = ["Datum", "Typ", "Vorgang", "Gegenpartei", "Zahlungsart", "Status", "Betrag_EUR", "Notiz"];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
        if (r.kind === "zahlung") {
            const z = r.z;
            lines.push(
                [
                    formatDate(z.created_at),
                    "Zahlung",
                    finanzVorgangText(z),
                    patientNames.get(z.patient_id) ?? "—",
                    zahlungsartLabelFin(z.zahlungsart),
                    z.status,
                    z.betrag.toFixed(2).replace(".", ","),
                    (z.beschreibung ?? "").replace(/\r?\n/g, " ").trim(),
                ]
                    .map(esc)
                    .join(","),
            );
        } else {
            const b = r.b;
            lines.push(
                [
                    formatDate(b.created_at),
                    "Bestellung",
                    `Bestellung: ${b.artikel}`,
                    b.lieferant,
                    "—",
                    b.status,
                    b.gesamtbetrag != null && Number.isFinite(b.gesamtbetrag)
                        ? b.gesamtbetrag.toFixed(2).replace(".", ",")
                        : "",
                    (b.bemerkung ?? "").replace(/\r?\n/g, " ").trim(),
                ]
                    .map(esc)
                    .join(","),
            );
        }
    }
    return `\uFEFF${lines.join("\r\n")}`;
}
