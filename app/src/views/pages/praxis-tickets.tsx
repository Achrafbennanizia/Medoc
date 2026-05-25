import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    listPraxisTicketsForMe,
    updatePraxisTicketStatus,
    type PraxisTicket,
} from "@/controllers/akte-workflow.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";

export function PraxisTicketsPage() {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;

    const [rows, setRows] = useState<PraxisTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            setRows(await listPraxisTicketsForMe());
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

    const setStatus = async (id: string, status: "IN_BEARBEITUNG" | "ERLEDIGT") => {
        setBusyId(id);
        try {
            await updatePraxisTicketStatus(id, status);
            toast(t("page.praxis_tickets.updated_toast"), "success");
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    const isArzt = role === "ARZT";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div>
                    <h2 className="page-title">{t("page.praxis_tickets.title")}</h2>
                    <p className="page-sub" style={{ marginTop: 4 }}>
                        {isArzt ? t("page.praxis_tickets.subtitle_arzt") : t("page.praxis_tickets.subtitle_rezeption")}
                    </p>
                </div>
            </div>

            <div
                className="card"
                style={{
                    padding: "12px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
                role="note"
            >
                <p className="page-sub" style={{ margin: 0, flex: "1 1 240px" }}>
                    {t("page.praxis_tickets.posteingang_banner")}
                </p>
                <Link to="/posteingang" className="btn btn-subtle">
                    {t("page.praxis_tickets.posteingang_link")}
                </Link>
            </div>

            {loading ? (
                <PageLoading label={t("page.praxis_tickets.loading")} />
            ) : err ? (
                <PageLoadError message={err} onRetry={() => void load()} />
            ) : rows.length === 0 ? (
                <EmptyState icon="📬" title={t("page.praxis_tickets.empty_title")} />
            ) : (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div className="tbl-scroll">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>{t("page.praxis_tickets.col_status")}</th>
                                    <th>{t("page.praxis_tickets.col_patient")}</th>
                                    <th>{t("page.praxis_tickets.col_message")}</th>
                                    <th>{t("page.praxis_tickets.col_created")}</th>
                                    {isArzt ? <th>{t("page.praxis_tickets.col_actions")}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td><Badge>{r.status}</Badge></td>
                                        <td>
                                            <Link to={`/patienten/${r.patient_id}`} className="link" title={r.patient_id}>
                                                {t("page.praxis_tickets.open_akte")}
                                            </Link>
                                        </td>
                                        <td style={{ maxWidth: 360, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.body}</td>
                                        <td>{formatDateTime(r.created_at)}</td>
                                        {isArzt ? (
                                            <td>
                                                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                    {r.status === "OFFEN" ? (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={busyId === r.id}
                                                            onClick={() => void setStatus(r.id, "IN_BEARBEITUNG")}
                                                        >
                                                            {t("page.praxis_tickets.action_in_progress")}
                                                        </Button>
                                                    ) : null}
                                                    {r.status !== "ERLEDIGT" ? (
                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            disabled={busyId === r.id}
                                                            onClick={() => void setStatus(r.id, "ERLEDIGT")}
                                                        >
                                                            {t("page.praxis_tickets.action_done")}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        ) : null}
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
