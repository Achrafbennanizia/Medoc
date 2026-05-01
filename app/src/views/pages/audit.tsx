import { useCallback, useEffect, useState } from "react";
import { exportAuditCsv, listAuditLogs } from "../../controllers/audit.controller";
import { errorMessage, formatDateTime } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import type { AuditLog } from "../../models/types";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";

export function AuditPage() {
    const toast = useToastStore((s) => s.add);
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
            const text = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
            openExportPreview({
                format: "csv",
                title: "Audit-Log exportieren",
                hint: "Komma-getrennt (RFC-4180). Spaltenköpfe sortieren, dann speichern oder drucken.",
                suggestedFilename: `audit-${new Date().toISOString().slice(0, 10)}.csv`,
                textBody: text,
            });
        } catch (e) {
            toast(`CSV-Export fehlgeschlagen: ${errorMessage(e)}`, "error");
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
                    onClick={() => void exportCsv()}
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
                                    <td
                                        style={{
                                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                            fontSize: 12,
                                            maxWidth: 140,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                        title={l.user_id}
                                    >
                                        {l.user_id}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
