import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAktenZuValidieren, validatePatientenakte, type AkteZuValidierenRow } from "@/systems/practice-host/controllers/akte-workflow.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

export function AktenZuValidierenPage() {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const [rows, setRows] = useState<AkteZuValidierenRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            setRows(await listAktenZuValidieren());
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
            await validatePatientenakte(patientId);
            toast(t("page.akten_zu_validieren.validated_toast"), "success");
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
                title={t("page.akten_zu_validieren.title")}
                subtitle={t("page.akten_zu_validieren.subtitle")}
            />

            {loading ? (
                <PageLoading label={t("page.akten_zu_validieren.loading")} />
            ) : err ? (
                <PageLoadError message={err} onRetry={() => void load()} />
            ) : rows.length === 0 ? (
                <EmptyState icon="✓" title={t("page.akten_zu_validieren.empty_title")} />
            ) : (
                <div className="card tbl-data-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div className="tbl-scroll">
                        <table className="tbl tbl-fluid">
                            <thead>
                                <tr>
                                    <th>{t("page.akten_zu_validieren.col_patient")}</th>
                                    <th>{t("page.akten_zu_validieren.col_status")}</th>
                                    <th>{t("page.akten_zu_validieren.col_updated")}</th>
                                    <th>{t("page.akten_zu_validieren.col_actions")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.patient_id}>
                                        <td>
                                            <Link to={`/patienten/${r.patient_id}`} className="link">
                                                {r.patient_name}
                                            </Link>
                                        </td>
                                        <td><Badge>{r.akte_status}</Badge></td>
                                        <td>{formatDateTime(r.updated_at)}</td>
                                        <td>
                                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    disabled={busyId === r.patient_id}
                                                    onClick={() => void onValidate(r.patient_id)}
                                                >
                                                    {busyId === r.patient_id ? "…" : t("page.akten_zu_validieren.validate")}
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
