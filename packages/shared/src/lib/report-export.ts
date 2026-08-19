import { translateLocale, useLocale, bcp47ForLocale, type Locale } from "@/lib/i18n";
import type { BalanceSheet, StatisticsOverview, Payment } from "@/models/types";
import type { BalanceSheetSnapshot } from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import type { PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import type {
    Dpia,
    LogRetentionReport,
    VVT,
} from "@/systems/practice-host/controllers/compliance.controller";
import {
    buildInvoiceHeaderAddressLinesForExport,
    getInvoicePracticeFromStorage,
} from "@/lib/invoice-service-item";
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

/** Shared bundle for Statistics, BalanceSheet, and other tabular practice reports. */
export interface ReportBundle {
    docTitle: string;
    exportTitle: string;
    hint: string;
    suggestedBasename: string;
    generatedAt: string;
    summary: ReportSummaryRow[];
    sections: ReportSection[];
}

function escapeCsvCell(version: string | number): string {
    return `"${String(version).replace(/"/g, '""')}"`;
}

function practiceContext(): { practiceName: string; practiceAddress: string[] } {
    const practice = getInvoicePracticeFromStorage();
    return {
        practiceName: practice.name?.trim() || "Dental practice",
        practiceAddress: buildInvoiceHeaderAddressLinesForExport(practice),
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
    const rows: (string | number)[][] = [["Section", "Metric", "Value"]];
    for (const r of bundle.summary) {
        rows.push(["Summary", r.label, r.value]);
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
export function buildStatisticsReportBundle(stats: StatisticsOverview, period: Period, locale?: Locale): ReportBundle {
    const loc = locale ?? useLocale.getState().locale;
    const tr = (key: string) => translateLocale(loc, key);
    const pl = periodLabel(period, loc);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const detailRows: string[][] = [];
    detailRows.push([tr("export.report.patients_total"), String(stats.patients_total)]);
    detailRows.push([tr("export.report.products_low_stock"), String(stats.products_low)]);
    detailRows.push([tr("export.report.income_current_month"), formatCurrency(stats.income_current_month, loc)]);
    for (const m of stats.new_patients_per_month) {
        detailRows.push([`${tr("export.report.new_patients")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.income_per_month) {
        detailRows.push([`${tr("export.report.income")} ${m.month}`, formatCurrency(m.value, loc)]);
    }
    for (const m of stats.appointments_per_month) {
        detailRows.push([`${tr("export.report.appointments")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.treatments_per_month) {
        detailRows.push([`${tr("export.report.treatments")} ${m.month}`, String(m.value)]);
    }
    for (const m of stats.orders_per_month) {
        detailRows.push([`${tr("export.report.orders")} ${m.month}`, String(m.value)]);
    }
    for (const version of stats.age_groups) {
        detailRows.push([`${tr("export.report.age_group")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.sexes) {
        detailRows.push([`${tr("export.report.gender")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.treatments_by_category) {
        detailRows.push([`${tr("export.report.treatment_category")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.disease_patterns_top ?? []) {
        detailRows.push([`${tr("export.report.condition")} ${version.label}`, String(version.value)]);
    }
    for (const m of stats.disease_patterns_monthly ?? []) {
        detailRows.push([`${tr("export.report.condition_trend")} ${m.month}`, String(m.value)]);
    }
    for (const version of stats.medications_top) {
        detailRows.push([`${tr("export.report.top_ingredient")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.appointment_status) {
        detailRows.push([`${tr("export.report.appointment_status")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.appointment_kind) {
        detailRows.push([`${tr("export.report.appointment_type")} ${version.label}`, String(version.value)]);
    }
    for (const version of stats.orders_by_status) {
        detailRows.push([`${tr("export.report.order_status")} ${version.label}`, String(version.value)]);
    }

    const incomeRows = stats.income_per_month.map((m) => [m.month, formatCurrency(m.value, loc)]);
    const paymentMethodRows = stats.revenue_by_payment_method.map((version) => [version.label, formatCurrency(version.value, loc)]);

    return {
        docTitle: tr("export.report.statistics_doc_title"),
        exportTitle: tr("export.report.statistics_export_title"),
        hint: tr("export.report.statistics_hint").replace("{period}", pl),
        suggestedBasename: `medoc-statistics-${period}-${dateStamp}`,
        generatedAt: todayLocalized(loc),
        summary: [
            { label: tr("export.report.period"), value: pl },
            { label: tr("export.report.income_current_month"), value: formatCurrency(stats.income_current_month, loc) },
            { label: tr("export.report.patients_total"), value: String(stats.patients_total) },
        ],
        sections: [
            {
                title: tr("export.report.income_by_month"),
                headers: [tr("export.report.month"), tr("export.report.amount")],
                rows: incomeRows,
            },
            {
                title: tr("export.report.income_by_payment"),
                headers: [tr("export.report.payment_type"), tr("export.report.amount")],
                rows: paymentMethodRows,
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

/** BalanceSheet page — income / outstanding / monthly breakdown. */
export function buildBalanceSheetReportBundle(
    balanceSheet: BalanceSheet,
    byMonth: Array<[string, { income: number; outstanding: number; cancelled: number }]>,
    snapshots: BalanceSheetSnapshot[],
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const monthRows = byMonth.map(([month, version]) => [
        month,
        formatCurrency(version.income),
        formatCurrency(version.outstanding),
        formatCurrency(version.cancelled),
    ]);
    const snapRows = snapshots.map((s) => [
        s.label,
        formatCurrency(s.income_cents / 100),
        formatCurrency(s.expenses_cents / 100),
        formatCurrency(s.balance_cents / 100),
    ]);

    return {
        docTitle: "Balance — income report",
        exportTitle: "Export balance",
        hint: "Income, outstanding, monthly trend and snapshots — PDF with practice letterhead.",
        suggestedBasename: `medoc-balanceSheet-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Income (paid)", value: formatCurrency(balanceSheet.income) },
            { label: "Outstanding", value: formatCurrency(balanceSheet.outstanding) },
            { label: "Cancelled", value: formatCurrency(balanceSheet.cancelled) },
            { label: "Payment count", value: String(balanceSheet.payment_count) },
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

export type FinanceTxRow =
    | { kind: "payment"; z: Payment }
    | { kind: "purchase_order"; b: PurchaseOrder };

export interface FinanceKpiSnapshot {
    incomeMtd: number;
    incomeDeltaPct: number | null;
    st: number;
    openCount: number;
    openSum: number;
    profitMtd: number;
}

function paymentMethodLabelFin(kind: string): string {
    const map: Record<string, string> = {
        CASH: "Cash",
        CARD: "Card",
        BANK_TRANSFER: "Bank transfer",
        INVOICE: "Invoice",
    };
    return map[kind] ?? kind;
}

function financeTransactionText(z: Payment): string {
    const reference = z.treatment_id ? "Treatment" : z.examination_id ? "Examination" : "Direct payment";
    const note = (z.description ?? "").trim();
    if (note) return reference === "Direct payment" ? note : `${reference} — ${note}`;
    return reference;
}

/** Finance page — KPI summary + filtered transaction list. */
export function buildFinanceReportBundle(
    rows: FinanceTxRow[],
    patientNames: Map<string, string>,
    kpi: FinanceKpiSnapshot,
    filterLabel: string,
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const txRows = rows.map((r) => {
        if (r.kind === "payment") {
            const z = r.z;
            return [
                formatDate(z.created_at),
                "Payment",
                financeTransactionText(z),
                patientNames.get(z.patient_id) ?? "—",
                paymentMethodLabelFin(z.payment_method),
                z.status,
                formatCurrency(z.amount),
            ];
        }
        const b = r.b;
        return [
            formatDate(b.created_at),
            "Order",
            `Order: ${b.item}`,
            b.supplier,
            "—",
            b.status,
            b.total_amount != null && Number.isFinite(b.total_amount) ? formatCurrency(b.total_amount) : "—",
        ];
    });

    return {
        docTitle: "Finance — transaction report",
        exportTitle: "Export finance",
        hint: `${filterLabel} · PDF with practice letterhead or CSV/JSON/XML.`,
        suggestedBasename: `medoc-finance-${dateStamp}`,
        generatedAt: todayDe(),
        summary: [
            { label: "Filter", value: filterLabel },
            { label: "Income MTD", value: formatCurrency(kpi.incomeMtd) },
            { label: "Cancellations MTD", value: formatCurrency(kpi.st) },
            { label: "Profit MTD (net)", value: formatCurrency(kpi.profitMtd) },
            { label: "Open items", value: `${kpi.openCount} (${formatCurrency(kpi.openSum)})` },
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

export type ComplianceReportKind = "vvt" | "dpia" | "retention";

/** Compliance page — VVT, DPIA, or log-retention report. */
export function buildComplianceReportBundle(
    kind: ComplianceReportKind,
    data: VVT | Dpia | LogRetentionReport,
): ReportBundle {
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (kind === "vvt") {
        const version = data as VVT;
        const sections = version.activities.map((a) => ({
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
            generatedAt: formatDateTime(version.generated_at),
            summary: [
                { label: "Controller", value: version.controller },
                { label: "System", value: version.system },
                { label: "Version", value: version.system_version },
            ],
            sections,
        };
    }
    if (kind === "dpia") {
        const d = data as Dpia;
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
            suggestedBasename: `medoc-dpia-${dateStamp}`,
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
export function financeTransactionsToLegacyCsv(
    rows: FinanceTxRow[],
    patientNames: Map<string, string>,
): string {
    const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const header = ["Date", "Type", "Transaction", "Counterparty", "Payment method", "Status", "Amount_EUR", "Note"];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
        if (r.kind === "payment") {
            const z = r.z;
            lines.push(
                [
                    formatDate(z.created_at),
                    "Payment",
                    financeTransactionText(z),
                    patientNames.get(z.patient_id) ?? "—",
                    paymentMethodLabelFin(z.payment_method),
                    z.status,
                    z.amount.toFixed(2).replace(".", ","),
                    (z.description ?? "").replace(/\r?\n/g, " ").trim(),
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
                    `Order: ${b.item}`,
                    b.supplier,
                    "—",
                    b.status,
                    b.total_amount != null && Number.isFinite(b.total_amount)
                        ? b.total_amount.toFixed(2).replace(".", ",")
                        : "",
                    (b.remark ?? "").replace(/\r?\n/g, " ").trim(),
                ]
                    .map(esc)
                    .join(","),
            );
        }
    }
    return `\uFEFF${lines.join("\r\n")}`;
}
