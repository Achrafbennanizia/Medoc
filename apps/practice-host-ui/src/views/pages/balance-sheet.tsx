import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { Card, CardHeader } from "../components/ui/card";
import {
    getBalanceSheet,
    listPaymentsPaged,
    paymentMonthlyBreakdown,
} from "@/systems/practice-host/controllers/payment.controller";
import { listBalanceSheetSnapshots, type BalanceSheetSnapshot } from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import { issuedPdfBytes, reprintIssuedDocument } from "@/systems/practice-host/controllers/document.controller";
import { reprintPeriodReport } from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import { openExportPreview } from "@/models/store/export-preview-store";
import type { BalanceSheet, Payment } from "../../models/types";
import { paymentStatusDisplay } from "@/lib/finance-order-labels";
import { errorMessage, formatCurrency, formatDate, formatDateTime, kpiValueSizeClass } from "@/lib/utils";
import { buildBalanceSheetReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToastStore } from "../components/ui/toast-store";
import { Link } from "react-router-dom";

/**
 * BalanceSheet overview (FA-FIN-03 / FA-FIN-09 / FA-FIN-10).
 * Backend delivers aggregates (revenue, outstanding, cancelled).
 * Monthly chart uses SQL bucket aggregates (not a full payment download).
 */
export function BalanceSheetPage() {
    const t = useT();
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canBackAdministration = role != null && allowed("administration.read", role);
    const [balance_sheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
    const [byMonth, setByMonth] = useState<[string, { income: number; outstanding: number; cancelled: number }][]>([]);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [snapshots, setSnapshots] = useState<BalanceSheetSnapshot[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [status, setStatus] = useState<"loading" | "ready">("loading");
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setStatus("loading");
        Promise.all([
            getBalanceSheet(),
            paymentMonthlyBreakdown(12),
            listPaymentsPaged({ page: 1, pageSize: 20 }),
            listBalanceSheetSnapshots(),
        ])
            .then(([b, months, recent, snap]) => {
                if (!cancelled) {
                    setBalanceSheet(b);
                    setByMonth(
                        months.map((m) => [
                            m.yearMonth,
                            { income: m.income, outstanding: m.outstanding, cancelled: m.cancelled },
                        ]),
                    );
                    setRecentPayments(recent.items);
                    setSnapshots(snap);
                    setStatus("ready");
                }
            })
            .catch((e) => {
                if (!cancelled) setLoadError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    function snapshotDocumentId(payload: string): string | null {
        try {
            let parsed: unknown = JSON.parse(payload);
            if (typeof parsed === "string") parsed = JSON.parse(parsed);
            if (parsed == null || typeof parsed !== "object") return null;
            const row = parsed as { documentId?: unknown; document_id?: unknown };
            const id = row.documentId ?? row.document_id;
            return typeof id === "string" && id.trim() ? id : null;
        } catch {
            return null;
        }
    }

    /** Saved reports are final (numbered BE document); this prints a copy. */
    async function openSnapshotPdf(snap: BalanceSheetSnapshot) {
        try {
            const documentId = snapshotDocumentId(snap.payload);
            const pdf = documentId
                ? await reprintIssuedDocument(documentId).catch(() => reprintPeriodReport(snap.id))
                : await reprintPeriodReport(snap.id);
            openExportPreview({
                format: "pdf",
                title: `${snap.label} ${pdf.documentNumber ?? ""}`.trim(),
                hint: t("page.balance_sheet_new.pdf_hint_copy"),
                suggestedFilename: `${t("page.balance_sheet_new.pdf_filename")}-${(pdf.documentNumber ?? snap.id).replace(/[^\w.-]+/g, "_")}-${t("page.balance_sheet_new.pdf_file_copy")}.pdf`,
                binaryBody: issuedPdfBytes(pdf),
                context: { kind: "period_report", format: "pdf", entityId: snap.id, documentNumber: pdf.documentNumber },
            });
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }

    const max = Math.max(1, ...byMonth.map(([, version]) => version.income));

    const buildExportBundle = useCallback(() => {
        if (!balance_sheet) return null;
        return buildBalanceSheetReportBundle(balance_sheet, byMonth, snapshots);
    }, [balance_sheet, byMonth, snapshots]);

    if (loadError) {
        return <PageLoadError message={loadError} onRetry={reload} />;
    }
    if (status !== "ready" || !balance_sheet) {
        return <PageLoading label={t("balanceSheet.loading")} />;
    }

    const incomePaidLabel = formatCurrency(balance_sheet.income);
    const outstandingLabel = formatCurrency(balance_sheet.outstanding);
    const cancelledLabel = formatCurrency(balance_sheet.cancelled);

    return (
        <div className="practice-workspace-page animate-fade-in--sticky-safe">
            <AdministrationPageHeader
                showBack={canBackAdministration}
                title={t("balanceSheet.title")}
                actions={
                    <>
                        <ReportExportToolbar
                            dialogTitle={t("balanceSheet.export_title")}
                            buildBundle={buildExportBundle}
                            defaultFormat="pdf"
                            // TODO(later): restore Import — REPORT_IMPORT_UI_ENABLED + todos-deferred-ui-blinds.md
                            // showImport
                        />
                        <Link to="/balance-sheet/new" className="btn btn-subtle">{t("balanceSheet.new_btn")}</Link>
                    </>
                }
            />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "var(--space-4)",
                }}
            >
                <Card className="kpi">
                    <CardHeader title={t("balanceSheet.kpi.income_paid")} />
                    <p className={kpiValueSizeClass(incomePaidLabel)} style={{ color: "var(--accent-green)" }}>{incomePaidLabel}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("balanceSheet.kpi.pending")} />
                    <p className={kpiValueSizeClass(outstandingLabel)} style={{ color: "var(--accent-yellow)" }}>{outstandingLabel}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("balanceSheet.kpi.cancelled")} />
                    <p className={kpiValueSizeClass(cancelledLabel)} style={{ color: "var(--fg-3)" }}>{cancelledLabel}</p>
                </Card>
            </div>

            <Card className="card-pad">
                <CardHeader title={t("balanceSheet.monthly_title")} />
                {byMonth.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("balanceSheet.no_payments_yet")}</p>
                ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-3)" }} role="list" aria-label={t("balanceSheet.monthly_aria")}>
                        {byMonth.map(([month, version]) => (
                            <li key={month}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
                                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{month}</span>
                                    <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{formatCurrency(version.income)}</span>
                                </div>
                                <div style={{ marginTop: "var(--space-2)", height: 8, background: "var(--line)", borderRadius: 6 }}>
                                    <div
                                        className="bar"
                                        style={{ width: `${(version.income / max) * 100}%` }}
                                        aria-hidden
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="card-pad">
                <CardHeader title={t("balanceSheet.snapshots_title")} />
                {snapshots.length === 0 ? (
                    <p className="text-body text-on-surface-variant">
                        {t("balanceSheet.snapshots_empty")}
                    </p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.created_at")}</th>
                                <th>{t("balanceSheet.col.label")}</th>
                                <th>{t("balanceSheet.col.income")}</th>
                                <th>{t("balanceSheet.col.expenses")}</th>
                                <th>{t("balanceSheet.col.balance")}</th>
                                <th aria-label={t("common.actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((s) => (
                                <tr key={s.id}>
                                    <td>{formatDateTime(s.created_at)}</td>
                                    <td>{s.label}</td>
                                    <td>{formatCurrency(s.income_cents / 100)}</td>
                                    <td>{formatCurrency(s.expenses_cents / 100)}</td>
                                    <td style={{ color: s.balance_cents >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                                        {formatCurrency(s.balance_cents / 100)}
                                    </td>
                                    <td>
                                        <Button size="sm" variant="secondary" onClick={() => void openSnapshotPdf(s)}>
                                            {t("balanceSheet.pdf_copy")}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </Card>

            <Card className="card-pad">
                <CardHeader title={t("balanceSheet.recent_payments")} />
                {recentPayments.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("balanceSheet.no_payments")}</p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.date")}</th><th>{t("common.status")}</th><th>{t("common.amount")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.map((z) => {
                                const st = paymentStatusDisplay(z.status, t);
                                return (
                                <tr key={z.id}>
                                    <td>{formatDate(z.created_at)}</td>
                                    <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                    <td>{formatCurrency(z.amount)}</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
