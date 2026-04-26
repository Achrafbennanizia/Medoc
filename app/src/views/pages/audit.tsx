import { useCallback, useEffect, useState } from "react";
import { exportAuditCsv, listAuditLogs } from "../../controllers/audit.controller";
import { errorMessage, formatDateTime } from "../../lib/utils";
import type { AuditLog } from "../../models/types";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await listAuditLogs();
            setLogs(data);
        } catch (e) {
            setLoadError(errorMessage(e));
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const exportCsv = async () => {
        setBusy(true);
        try {
            const bytes = await exportAuditCsv();
            const blob = new Blob([new Uint8Array(bytes)], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <h2 className="page-title">Audit-Log</h2>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={busy || logs.length === 0 || !!loadError}
                    className="btn btn-subtle"
                >
                    {busy ? "Export…" : "CSV exportieren"}
                </button>
            </div>

            {loading ? (
                <PageLoading label="Audit-Einträge werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : logs.length === 0 ? (
                <EmptyState icon="📋" title="Keine Audit-Einträge" />
            ) : (
                <div className="card">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Zeitpunkt</th><th>Aktion</th><th>Entität</th><th>Details</th><th>Benutzer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id}>
                                    <td>{formatDateTime(l.created_at)}</td>
                                    <td><Badge>{l.action}</Badge></td>
                                    <td>{l.entity}</td>
                                    <td>{l.details || "–"}</td>
                                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{l.user_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
