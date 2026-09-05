import { useT, useTParams } from "@/lib/i18n";
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
import { listBalanceSheetSnapshots, deleteBalanceSheetSnapshot, type BalanceSheetSnapshot } from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import type { BalanceSheet, Payment } from "../../models/types";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { buildBalanceSheetReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
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
    const tp = useTParams();
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canBackAdministration = role != null && allowed("administration.read", role);
    const [balance_sheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
    const [byMonth, setByMonth] = useState<[string, { income: number; outstanding: number; cancelled: number }][]>([]);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [snapshots, setSnapshots] = useState<BalanceSheetSnapshot[]>([]);
    const [snapshotDeleteId, setSnapshotDeleteId] = useState<string | null>(null);
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

    async function handleDeleteSnapshot() {
        if (!snapshotDeleteId) return;
        try {
            await deleteBalanceSheetSnapshot(snapshotDeleteId);
            setSnapshots((list) => list.filter((s) => s.id !== snapshotDeleteId));
            toast(t("balance-sheet.toast.snapshot_deleted"), "success");
        } catch (e) {
            toast(tp("balance-sheet.toast.delete_failed", { message: errorMessage(e) }), "error");
        } finally {
            setSnapshotDeleteId(null);
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
        return <PageLoading label={t("balance-sheet.loading")} />;
    }

    return (
        <div className="practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                showBack={canBackAdministration}
                title={t("balance-sheet.title")}
                actions={
                    <>
                        <ReportExportToolbar
                            dialogTitle={t("balance-sheet.export_title")}
                            buildBundle={buildExportBundle}
                            defaultFormat="pdf"
                            // TODO(later): restore Import — REPORT_IMPORT_UI_ENABLED + todos-deferred-ui-blinds.md
                            // showImport
                        />
                        <Link to="/balance-sheet/new" className="btn btn-subtle">{t("balance-sheet.new_btn")}</Link>
                    </>
                }
            />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                }}
            >
                <Card className="kpi">
                    <CardHeader title={t("balance-sheet.kpi.income_paid")} />
                    <p className="kpi-val" style={{ color: "var(--accent-green)" }}>{formatCurrency(balance_sheet.income)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("balance-sheet.kpi.pending")} />
                    <p className="kpi-val" style={{ color: "var(--accent-yellow)" }}>{formatCurrency(balance_sheet.outstanding)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("balance-sheet.kpi.cancelled")} />
                    <p className="kpi-val" style={{ color: "var(--fg-3)" }}>{formatCurrency(balance_sheet.cancelled)}</p>
                </Card>
            </div>

            <Card className="card-pad">
                <CardHeader title={t("balance-sheet.monthly_title")} />
                {byMonth.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("balance-sheet.no_payments_yet")}</p>
                ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }} role="list" aria-label={t("balance-sheet.monthly_aria")}>
                        {byMonth.map(([month, version]) => (
                            <li key={month}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{month}</span>
                                    <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{formatCurrency(version.income)}</span>
                                </div>
                                <div style={{ marginTop: 6, height: 8, background: "var(--line)", borderRadius: 6 }}>
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
                <CardHeader title={t("balance-sheet.snapshots_title")} />
                {snapshots.length === 0 ? (
                    <p className="text-body text-on-surface-variant">
                        {t("balance-sheet.snapshots_empty")}
                    </p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.created_at")}</th>
                                <th>{t("balance-sheet.col.label")}</th>
                                <th>{t("balance-sheet.col.income")}</th>
                                <th>{t("balance-sheet.col.expenses")}</th>
                                <th>{t("balance-sheet.col.balance")}</th>
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
                                        <Button size="sm" variant="ghost" onClick={() => setSnapshotDeleteId(s.id)}>
                                            {t("common.delete")}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </Card>

            <ConfirmDialog
                open={!!snapshotDeleteId}
                onClose={() => setSnapshotDeleteId(null)}
                onConfirm={handleDeleteSnapshot}
                title={t("balance-sheet.delete_title")}
                message={t("balance-sheet.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />

            <Card className="card-pad">
                <CardHeader title={t("balance-sheet.recent_payments")} />
                {recentPayments.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("balance-sheet.no_payments")}</p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.date")}</th><th>{t("common.status")}</th><th>{t("common.amount")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentPayments.map((z) => (
                                <tr key={z.id}>
                                    <td>{formatDate(z.created_at)}</td>
                                    <td>{z.status}</td>
                                    <td>{formatCurrency(z.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
