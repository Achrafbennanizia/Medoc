import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { Card, CardHeader } from "../components/ui/card";
import { listZahlungen, getBilanz } from "@/systems/practice-host/controllers/zahlung.controller";
import { listBilanzSnapshots, deleteBilanzSnapshot, type BilanzSnapshot } from "@/systems/practice-host/controllers/bilanz-snapshot.controller";
import type { Zahlung, Bilanz } from "../../models/types";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { buildBilanzReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { useToastStore } from "../components/ui/toast-store";

/**
 * Bilanz overview (FA-FIN-03 / FA-FIN-09 / FA-FIN-10).
 * Backend delivers aggregates (revenue, outstanding, cancelled).
 * Frontend adds monthly breakdown from payment list.
 */
export function BilanzPage() {
    const t = useT();
    const tp = useTParams();
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canBackVerwaltung = role != null && allowed("verwaltung.read", role);
    const [bilanz, setBilanz] = useState<Bilanz | null>(null);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [snapshots, setSnapshots] = useState<BilanzSnapshot[]>([]);
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
        Promise.all([getBilanz(), listZahlungen(), listBilanzSnapshots()])
            .then(([b, z, snap]) => {
                if (!cancelled) {
                    setBilanz(b);
                    setZahlungen(z);
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
            await deleteBilanzSnapshot(snapshotDeleteId);
            setSnapshots((list) => list.filter((s) => s.id !== snapshotDeleteId));
            toast(t("bilanz.toast.snapshot_deleted"), "success");
        } catch (e) {
            toast(tp("bilanz.toast.delete_failed", { message: errorMessage(e) }), "error");
        } finally {
            setSnapshotDeleteId(null);
        }
    }

    const byMonth = useMemo(() => {
        const m = new Map<string, { einnahmen: number; ausstehend: number; storniert: number }>();
        for (const z of zahlungen) {
            const key = z.created_at.slice(0, 7); // YYYY-MM
            const cur = m.get(key) ?? { einnahmen: 0, ausstehend: 0, storniert: 0 };
            if (z.status === "BEZAHLT") cur.einnahmen += z.betrag;
            else if (z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT") cur.ausstehend += z.betrag;
            else if (z.status === "STORNIERT") cur.storniert += z.betrag;
            m.set(key, cur);
        }
        return Array.from(m.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 12);
    }, [zahlungen]);

    const max = Math.max(1, ...byMonth.map(([, v]) => v.einnahmen));

    const buildExportBundle = useCallback(() => {
        if (!bilanz) return null;
        return buildBilanzReportBundle(bilanz, byMonth, snapshots);
    }, [bilanz, byMonth, snapshots]);

    if (loadError) {
        return <PageLoadError message={loadError} onRetry={reload} />;
    }
    if (status !== "ready" || !bilanz) {
        return <PageLoading label={t("bilanz.loading")} />;
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                showBack={canBackVerwaltung}
                title={t("bilanz.title")}
                actions={
                    <>
                        <ReportExportToolbar
                            dialogTitle={t("bilanz.export_title")}
                            buildBundle={buildExportBundle}
                            defaultFormat="pdf"
                            showImport
                        />
                        <Link to="/bilanz/neu" className="btn btn-subtle">{t("bilanz.new_btn")}</Link>
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
                    <CardHeader title={t("bilanz.kpi.income_paid")} />
                    <p className="kpi-val" style={{ color: "var(--accent-green)" }}>{formatCurrency(bilanz.einnahmen)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("bilanz.kpi.pending")} />
                    <p className="kpi-val" style={{ color: "var(--accent-yellow)" }}>{formatCurrency(bilanz.ausstehend)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title={t("bilanz.kpi.cancelled")} />
                    <p className="kpi-val" style={{ color: "var(--fg-3)" }}>{formatCurrency(bilanz.storniert)}</p>
                </Card>
            </div>

            <Card className="card-pad">
                <CardHeader title={t("bilanz.monthly_title")} />
                {byMonth.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("bilanz.no_payments_yet")}</p>
                ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }} role="list" aria-label={t("bilanz.monthly_aria")}>
                        {byMonth.map(([month, v]) => (
                            <li key={month}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{month}</span>
                                    <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{formatCurrency(v.einnahmen)}</span>
                                </div>
                                <div style={{ marginTop: 6, height: 8, background: "var(--line)", borderRadius: 6 }}>
                                    <div
                                        className="bar"
                                        style={{ width: `${(v.einnahmen / max) * 100}%` }}
                                        aria-hidden
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="card-pad">
                <CardHeader title={t("bilanz.snapshots_title")} />
                {snapshots.length === 0 ? (
                    <p className="text-body text-on-surface-variant">
                        {t("bilanz.snapshots_empty")}
                    </p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.created_at")}</th>
                                <th>{t("bilanz.col.label")}</th>
                                <th>{t("bilanz.col.income")}</th>
                                <th>{t("bilanz.col.expenses")}</th>
                                <th>{t("bilanz.col.balance")}</th>
                                <th aria-label={t("common.actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((s) => (
                                <tr key={s.id}>
                                    <td>{formatDateTime(s.created_at)}</td>
                                    <td>{s.label}</td>
                                    <td>{formatCurrency(s.einnahmen_cents / 100)}</td>
                                    <td>{formatCurrency(s.ausgaben_cents / 100)}</td>
                                    <td style={{ color: s.saldo_cents >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                                        {formatCurrency(s.saldo_cents / 100)}
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
                title={t("bilanz.delete_title")}
                message={t("bilanz.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />

            <Card className="card-pad">
                <CardHeader title={t("bilanz.recent_payments")} />
                {zahlungen.length === 0 ? (
                    <p className="text-body text-on-surface-variant">{t("bilanz.no_payments")}</p>
                ) : (
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.date")}</th><th>{t("common.status")}</th><th>{t("common.amount")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zahlungen.slice(0, 20).map((z) => (
                                <tr key={z.id}>
                                    <td>{formatDate(z.created_at)}</td>
                                    <td>{z.status}</td>
                                    <td>{formatCurrency(z.betrag)}</td>
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
