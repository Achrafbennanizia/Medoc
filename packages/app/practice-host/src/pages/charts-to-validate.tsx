import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
    listChartsToValidate,
    validatePatientChart,
    declinePatientChart,
    type ChartToValidateRow,
} from "@/systems/practice-host/controllers/chart-workflow.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { useT } from "@/lib/i18n";
import { CHART_QUEUE_DECLINE_ENABLED } from "@/lib/v1-ui-flags";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { useToastStore } from "@/views/components/ui/toast-store";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";
import { XIcon } from "@/lib/icons";

function chartStatusLabel(status: string, t: (key: string) => string): string {
    const key = `enum.charts_status.${status.trim().toLowerCase()}`;
    const label = t(key);
    return label === key ? status : label;
}

function chartStatusBadgeVariant(status: string): "primary" | "warning" | "success" | "default" {
    switch (status.trim().toUpperCase()) {
        case "DRAFT":
            return "warning";
        case "IN_PROGRESS":
            return "primary";
        case "VALIDATED":
            return "success";
        default:
            return "default";
    }
}

export function ChartsToValidatePage() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWriteMedical = role != null && allowed("patient.write_medical", role, session?.permission_overrides);
    const [rows, setRows] = useState<ChartToValidateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) {
            setLoading(true);
            setErr(null);
        }
        try {
            setRows(await listChartsToValidate());
            if (opts?.silent) setErr(null);
        } catch (e) {
            if (!opts?.silent) {
                setErr(errorMessage(e));
                setRows([]);
            }
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const onRefresh = () => {
            void load({ silent: true });
        };
        window.addEventListener("medoc-nav-badges-refresh", onRefresh);
        const interval = window.setInterval(() => {
            void load({ silent: true });
        }, 15_000);
        const onVisible = () => {
            if (document.visibilityState === "visible") void load({ silent: true });
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("medoc-nav-badges-refresh", onRefresh);
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
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

    const onDecline = async (patientId: string) => {
        setBusyId(patientId);
        try {
            await declinePatientChart(patientId);
            toast(t("page.charts_to_validate.declined_toast"), "success");
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
                        <table className="tbl tbl-fluid tbl-charts-queue">
                            <colgroup>
                                <col className="charts-queue-col-patient" />
                                <col className="charts-queue-col-status" />
                                <col className="charts-queue-col-updated" />
                                <col className="charts-queue-col-action" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="col">{t("page.charts_to_validate.col_patient")}</th>
                                    <th scope="col" className="charts-queue-th-status">{t("page.charts_to_validate.col_status")}</th>
                                    <th scope="col" className="charts-queue-th-updated">{t("page.charts_to_validate.col_updated")}</th>
                                    <th scope="col" className="charts-queue-th-action">{t("page.charts_to_validate.col_actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const busy = busyId === r.patient_id;
                                    const openPatient = () => navigate(`/patients/${r.patient_id}`);
                                    const stopRowNav = (e: MouseEvent) => {
                                        e.stopPropagation();
                                    };
                                    const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openPatient();
                                        }
                                    };
                                    return (
                                    <tr
                                        key={r.patient_id}
                                        className="charts-queue-row"
                                        tabIndex={0}
                                        onClick={openPatient}
                                        onKeyDown={onRowKeyDown}
                                    >
                                        <td className="charts-queue-td-patient">
                                            <span className="link">{r.patient_name}</span>
                                        </td>
                                        <td className="charts-queue-td-status">
                                            <Badge variant={chartStatusBadgeVariant(r.chart_status)}>
                                                {chartStatusLabel(r.chart_status, t)}
                                            </Badge>
                                        </td>
                                        <td className="charts-queue-td-updated">{formatDateTime(r.updated_at)}</td>
                                        <td
                                            className="charts-queue-td-action"
                                            onClick={stopRowNav}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        >
                                            {canWriteMedical ? (
                                            <div className="charts-queue-actions">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    disabled={busy}
                                                    onClick={() => void onValidate(r.patient_id)}
                                                >
                                                    {busy ? "…" : t("page.charts_to_validate.validate")}
                                                </Button>
                                                {/* TODO(later): restore Decline — see docs/coordination/todos-deferred-ui-blinds.md */}
                                                {CHART_QUEUE_DECLINE_ENABLED ? (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={busy}
                                                    onClick={() => void onDecline(r.patient_id)}
                                                >
                                                    {busy ? "…" : t("page.charts_to_validate.decline")}
                                                </Button>
                                                ) : null}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="charts-queue-remove-btn"
                                                    disabled={busy}
                                                    title={t("page.charts_to_validate.remove_from_list")}
                                                    aria-label={t("page.charts_to_validate.remove_from_list")}
                                                    onClick={() => void onDecline(r.patient_id)}
                                                >
                                                    <XIcon size={16} />
                                                </Button>
                                            </div>
                                            ) : null}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
