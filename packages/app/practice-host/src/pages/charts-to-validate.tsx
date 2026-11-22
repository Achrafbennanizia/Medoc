import { useCallback, useEffect, useRef, useState } from "react";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";
import { usePageRefresh } from "@/views/layouts/page-refresh";
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
import { DataTable } from "@/views/components/ui/data-table";
import { StatusBadge } from "@/views/components/ui/status-badge";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { useToastStore } from "@/views/components/ui/toast-store";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";
import { XIcon } from "@/lib/icons";

export function ChartsToValidatePage() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWriteMedical = role != null && allowed("patient.write_medical", role, session?.permission_overrides);
    const [rows, setRows] = useState<ChartToValidateRow[]>(() => readListSnapshot<ChartToValidateRow[]>("charts-to-validate") ?? []);
    const [loading, setLoading] = useState(() => !readListSnapshot<ChartToValidateRow[]>("charts-to-validate"));
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const hadRows = useRef(readListSnapshot<ChartToValidateRow[]>("charts-to-validate") !== undefined);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) {
            setLoading(true);
            setErr(null);
        }
        try {
            const next = await listChartsToValidate();
            setRows(next);
            writeListSnapshot("charts-to-validate", next);
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
        void load({ silent: hadRows.current });
        hadRows.current = true;
        const onRefresh = () => {
            void load({ silent: true });
        };
        window.addEventListener("medoc-nav-badges-refresh", onRefresh);
        const onVisible = () => {
            if (document.visibilityState === "visible") void load({ silent: true });
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("medoc-nav-badges-refresh", onRefresh);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [load]);

    usePageRefresh(() => {
        void load({ silent: true });
    });

    const onValidate = async (patientId: string) => {
        setBusyId(patientId);
        try {
            await validatePatientChart(patientId);
            toast(t("page.charts_to_validate.validated_toast"), "success");
            window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
            await load({ silent: true });
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
            await load({ silent: true });
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }} className="animate-fade-in">
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
                        <DataTable
                            label={t("page.charts_to_validate.title")}
                            rows={rows}
                            getRowId={(r) => r.patient_id}
                            onRowActivate={(r) => navigate(`/patients/${r.patient_id}`)}
                            rowLabel={(r) => r.patient_name}
                            columns={[
                                { id: "patient", header: t("page.charts_to_validate.col_patient"), truncate: true, text: (r) => r.patient_name, cell: (r) => <span className="link">{r.patient_name}</span> },
                                { id: "status", header: t("page.charts_to_validate.col_status"), width: "9.5rem", cell: (r) => <StatusBadge entity="patient_chart" status={r.chart_status} /> },
                                { id: "updated", header: t("page.charts_to_validate.col_updated"), width: "10.5rem", hideBelow: "sm", cell: (r) => formatDateTime(r.updated_at) },
                                {
                                    id: "actions",
                                    header: t("page.charts_to_validate.col_actions"),
                                    srOnlyHeader: true,
                                    width: CHART_QUEUE_DECLINE_ENABLED ? "17rem" : "11rem",
                                    align: "end",
                                    cell: (r) => {
                                        if (!canWriteMedical) return null;
                                        const busy = busyId === r.patient_id;
                                        return (
                                            // Buttons inside an activatable row must not also open the patient.
                                            <div className="charts-queue-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                                <Button size="sm" variant="primary" disabled={busy} onClick={() => void onValidate(r.patient_id)}>
                                                    {busy ? "…" : t("page.charts_to_validate.validate")}
                                                </Button>
                                                {/* TODO(later): restore Decline — see docs/coordination/todos-deferred-ui-blinds.md */}
                                                {CHART_QUEUE_DECLINE_ENABLED ? (
                                                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onDecline(r.patient_id)}>
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
                                        );
                                    },
                                },
                            ]}
                        />
                </div>
            )}
        </div>
    );
}
