import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    listChartsToValidate,
    validatePatientChart,
    type ChartToValidateRow,
} from "@/systems/practice-host/controllers/chart-workflow.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { useToastStore } from "@/views/components/ui/toast-store";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";

function chartStatusLabel(status: string, t: (key: string) => string): string {
    const key = `enum.charts_status.${status.trim().toLowerCase()}`;
    const label = t(key);
    return label === key ? status : label;
}

export function ChartsToValidatePage() {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const [rows, setRows] = useState<ChartToValidateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            setRows(await listChartsToValidate());
        } catch (e) {
            setErr(errorMessage(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const onValidate = async (patientId: string) => {
        setBusyId(patientId);
        try {
            await validatePatientChart(patientId);
            toast(t("page.charts_to_validate.validated_toast"), "success");
            window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <WorkspacePageHeader
                title={t("page.charts_to_validate.title")}
                subtitle={t("page.charts_to_validate.subtitle")}
                actions={(
                    <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
                        {t("page.charts_to_validate.refresh")}
                    </Button>
                )}
            />

            {loading ? (
                <PageLoading label={t("page.charts_to_validate.loading")} />
            ) : err ? (
                <PageLoadError message={err} onRetry={() => void load()} />
            ) : rows.length === 0 ? (
                <EmptyState icon="✓" title={t("page.charts_to_validate.empty_title")} />
            ) : (
                <div className="card tbl-data-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div className="tbl-scroll">
                        <table className="tbl tbl-fluid">
                            <thead>
                                <tr>
                                    <th>{t("page.charts_to_validate.col_patient")}</th>
                                    <th>{t("page.charts_to_validate.col_status")}</th>
                                    <th>{t("page.charts_to_validate.col_updated")}</th>
                                    <th>{t("page.charts_to_validate.col_actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.patient_id}>
                                        <td>
                                            <Link to={`/patients/${r.patient_id}`} className="link">
                                                {r.patient_name}
                                            </Link>
                                        </td>
                                        <td>
                                            <Badge variant={r.chart_status === "DRAFT" ? "warning" : "default"}>
                                                {chartStatusLabel(r.chart_status, t)}
                                            </Badge>
                                        </td>
                                        <td>{formatDateTime(r.updated_at)}</td>
                                        <td>
                                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                                <Link
                                                    to={`/patients/${r.patient_id}`}
                                                    className="btn btn-subtle"
                                                    style={{ padding: "5px 10px", fontSize: 12 }}
                                                >
                                                    {t("page.charts_to_validate.open_chart")}
                                                </Link>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    disabled={busyId === r.patient_id}
                                                    onClick={() => void onValidate(r.patient_id)}
                                                >
                                                    {busyId === r.patient_id ? "…" : t("page.charts_to_validate.validate")}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
