import { translateLocale, useLocale, bcp47ForLocale, type Locale } from "@/lib/i18n";
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
        practiceName: praxis.name?.trim() || "Dental practice",
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

export async function buildReportPdfBytes(bundle: ReportBundle): Promise<Uint8Array> {
    return renderReportPdf(toReportPdfInput(bundle));
}

export async function exportReportBundle(bundle: ReportBundle, format: ReportExportFormat): Promise<void> {
    const filename = reportFilename(bundle, format);
    if (format === "pdf") {
        const bytes = await buildReportPdfBytes(bundle);
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

function periodLabel(period: Period, locale: Locale): string {
    return translateLocale(locale, period === "6m" ? "export.report.period_6m" : "export.report.period_12m");
}

function todayLocalized(locale: Locale): string {
    return new Date().toLocaleDateString(bcp47ForLocale(locale));
}

/** Statistics page — full overview including income section. */
export function buildStatistikReportBundle(stats: StatistikOverview, period: Period, locale?: Locale): ReportBundle {
    const loc = locale ?? useLocale.getState().locale;
    const tr = (key: string) => translateLocale(loc, key);
    const pl = periodLabel(period, loc);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const detailRows: string[][] = [];
    detailRows.push([tr("export.report.patients_total"), String(stats.patienten_gesamt)]);
    detailRows.push([tr("export.report.products_low_stock"), String(stats.produkte_niedrig)]);
    detailRows.push([tr("export.report.income_current_month"), formatCurrency(stats.einnahmen_aktueller_monat, loc)]);
    for (const m of stats.patienten_neu_pro_monat) {
        detailRows.push([`${tr("export.report.new_patients")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.einnahmen_pro_monat) {
        detailRows.push([`${tr("export.report.income")} ${m.month}`, formatCurrency(m.value, loc)]);
    }
    for (const m of stats.termine_pro_monat) {
        detailRows.push([`${tr("export.report.appointments")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.behandlungen_pro_monat) {
        detailRows.push([`${tr("export.report.treatments")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.bestellungen_pro_monat) {
        detailRows.push([`${tr("export.report.orders")} ${m.month}`, String(m.value)]);
    }
    for (const v of stats.altersgruppen) {
        detailRows.push([`${tr("export.report.age_group")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.geschlechter) {
        detailRows.push([`${tr("export.report.gender")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.behandlungen_nach_kategorie) {
        detailRows.push([`${tr("export.report.treatment_category")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.krankheitsbilder_top ?? []) {
        detailRows.push([`${tr("export.report.condition")} ${v.label}`, String(v.value)]);
    }
    for (const m of stats.krankheitsbilder_verlauf_pro_monat ?? []) {
        detailRows.push([`${tr("export.report.condition_trend")} ${m.month}`, String(m.value)]);
    }
    for (const v of stats.medikamente_top) {
        detailRows.push([`${tr("export.report.top_ingredient")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.termin_status) {
        detailRows.push([`${tr("export.report.appointment_status")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.termin_art) {
        detailRows.push([`${tr("export.report.appointment_type")} ${v.label}`, String(v.value)]);
    }
    for (const v of stats.bestellungen_nach_status) {
        detailRows.push([`${tr("export.report.order_status")} ${v.label}`, String(v.value)]);
    }

    const einnahmenRows = stats.einnahmen_pro_monat.map((m) => [m.month, formatCurrency(m.value, loc)]);
    const zahlungsartRows = stats.umsatz_nach_zahlungsart.map((v) => [v.label, formatCurrency(v.value, loc)]);

    return {
        docTitle: tr("export.report.statistik_doc_title"),
        exportTitle: tr("export.report.statistik_export_title"),
        hint: tr("export.report.statistik_hint").replace("{period}", pl),
        suggestedBasename: `medoc-statistik-${period}-${dateStamp}`,
        generatedAt: todayLocalized(loc),
        summary: [
            { label: tr("export.report.period"), value: pl },
            { label: tr("export.report.income_current_month"), value: formatCurrency(stats.einnahmen_aktueller_monat, loc) },
            { label: tr("export.report.patients_total"), value: String(stats.patienten_gesamt) },
        ],
        sections: [
            {
                title: tr("export.report.income_by_month"),
                headers: [tr("export.report.month"), tr("export.report.amount")],
                rows: einnahmenRows,
            },
            {
                title: tr("export.report.income_by_payment"),
                headers: [tr("export.report.payment_type"), tr("export.report.amount")],
                rows: zahlungsartRows,
            },
            {
                title: tr("export.report.detail_metrics"),
                headers: [tr("export.report.metric"), tr("export.report.value")],
                rows: detailRows,
            },
        ],
    };
}

function todayDe(): string {
    return todayLocalized(useLocale.getState().locale);
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
        docTitle: "Balance — income report",
        exportTitle: "Export balance",
        hint: "Income, outstanding, monthly trend and snapshots — PDF with practice letterhead.",
        suggestedBasename: `medoc-bilanz-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Income (paid)", value: formatCurrency(bilanz.einnahmen) },
            { label: "Outstanding", value: formatCurrency(bilanz.ausstehend) },
            { label: "Cancelled", value: formatCurrency(bilanz.storniert) },
            { label: "Payment count", value: String(bilanz.anzahl_zahlungen) },
        ],
        sections: [
            {
                title: "Monthly trend (last 12 months)",
                headers: ["Month", "Income", "Outstanding", "Cancelled"],
                rows: monthRows,
            },
            ...(snapRows.length > 0
                ? [
                      {
                          title: "Saved balance snapshots",
                          headers: ["Label", "Income", "Expenses", "Balance"],
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
        BAR: "Cash",
        KARTE: "Card",
        UEBERWEISUNG: "Bank transfer",
        RECHNUNG: "Invoice",
    };
    return map[art] ?? art;
}

function finanzVorgangText(z: Zahlung): string {
    const bezug = z.behandlung_id ? "Treatment" : z.untersuchung_id ? "Examination" : "Direct payment";
    const note = (z.beschreibung ?? "").trim();
    if (note) return bezug === "Direct payment" ? note : `${bezug} — ${note}`;
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
                "Payment",
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
            "Order",
            `Order: ${b.artikel}`,
            b.lieferant,
            "—",
            b.status,
            b.gesamtbetrag != null && Number.isFinite(b.gesamtbetrag) ? formatCurrency(b.gesamtbetrag) : "—",
        ];
    });

    return {
        docTitle: "Finance — transaction report",
        exportTitle: "Export finance",
        hint: `${filterLabel} · PDF with practice letterhead or CSV/JSON/XML.`,
        suggestedBasename: `medoc-finanzen-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Filter", value: filterLabel },
            { label: "Income MTD", value: formatCurrency(kpi.einnM) },
            { label: "Cancellations MTD", value: formatCurrency(kpi.st) },
            { label: "Profit MTD (net)", value: formatCurrency(kpi.gew) },
            { label: "Open items", value: `${kpi.offeneN} (${formatCurrency(kpi.offeneSum)})` },
        ],
        sections: [
            {
                title: "Transactions",
                headers: ["Date", "Type", "Transaction", "Counterparty", "Payment method", "Status", "Amount"],
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
            headers: ["Field", "Content"],
            rows: [
                ["Purpose", a.purpose],
                ["Legal basis", a.legal_basis],
                ["Data categories", a.data_categories.join("; ")],
                ["Data subjects", a.data_subjects.join("; ")],
                ["Recipients", a.recipients.join("; ")],
                ["Retention", a.retention],
                ["Technical measures", a.technical_measures.join("; ")],
                ["Organisational measures", a.organisational_measures.join("; ")],
            ],
        }));
        return {
            docTitle: "Record of processing activities (ROPA / VVT)",
            exportTitle: "Export compliance report",
            hint: "GDPR Art. 30 · PDF/CSV/JSON/XML — same renderer as finance reports.",
            suggestedBasename: `medoc-vvt-${dateStamp}`,
            generatedAt: formatDateTime(v.generated_at),
            summary: [
                { label: "Controller", value: v.controller },
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
            docTitle: "Data protection impact assessment (DPIA / DSFA)",
            exportTitle: "Export compliance report",
            hint: "GDPR Art. 35 · PDF/CSV/JSON/XML.",
            suggestedBasename: `medoc-dsfa-${dateStamp}`,
            generatedAt: formatDateTime(d.generated_at),
            summary: [
                { label: "System", value: d.system },
                { label: "Version", value: d.system_version },
            ],
            sections: [
                {
                    title: "Processing description",
                    headers: ["Section", "Content"],
                    rows: [["Overview", d.processing_overview]],
                },
                {
                    title: "Necessity and proportionality",
                    headers: ["Section", "Content"],
                    rows: [["Assessment", d.necessity_proportionality]],
                },
                {
                    title: "Risk scenarios",
                    headers: ["No.", "Threat", "Likelihood", "Impact", "Residual risk", "Measures"],
                    rows: scenarioRows,
                },
            ],
        };
    }
    const r = data as LogRetentionReport;
    return {
        docTitle: "Log retention — run report",
        exportTitle: "Export compliance report",
        hint: "Retention run · PDF/CSV/JSON/XML.",
        suggestedBasename: `medoc-retention-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Entries scanned", value: String(r.scanned) },
            { label: "Kept", value: String(r.kept) },
            { label: "Deleted", value: String(r.deleted.length) },
            { label: "Errors", value: String(r.errors.length) },
        ],
        sections: [
            ...(r.deleted.length > 0
                ? [
                      {
                          title: "Deleted references",
                          headers: ["ID"],
                          rows: r.deleted.map((id) => [id]),
                      },
                  ]
                : []),
            ...(r.errors.length > 0
                ? [
                      {
                          title: "Errors",
                          headers: ["Message"],
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
        r[7] === "1" ? "Yes" : "No",
        r[2] ?? "",
    ]);
    return {
        docTitle: "Audit log — full export",
        exportTitle: "Export audit log",
        hint: "Full audit trail · PDF with practice letterhead or CSV/JSON/XML.",
        suggestedBasename: `medoc-audit-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Entries", value: String(totalHint ?? dataRows.length) },
            { label: "Export scope", value: "Full (backend)" },
        ],
        sections: [
            {
                title: "Audit entries",
                headers: ["Timestamp", "Action", "Entity", "Details", "Emergency", "User"],
                rows: tableRows,
            },
        ],
    };
}

/** Legacy comma-separated finance CSV (Excel-compatible). */
export function finanzenTransactionsToLegacyCsv(
    rows: FinanzTxRow[],
    patientNames: Map<string, string>,
): string {
    const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const header = ["Date", "Type", "Transaction", "Counterparty", "Payment method", "Status", "Amount_EUR", "Note"];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
        if (r.kind === "zahlung") {
            const z = r.z;
            lines.push(
                [
                    formatDate(z.created_at),
                    "Payment",
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
                    "Order",
                    `Order: ${b.artikel}`,
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
