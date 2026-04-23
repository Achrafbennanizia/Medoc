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
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Audit-Log</h2>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={busy || logs.length === 0 || !!loadError}
                    className="px-3 py-2 rounded-lg bg-primary-container text-primary text-body-medium hover:opacity-90 disabled:opacity-50"
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
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Zeitpunkt</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Aktion</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Entität</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Details</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Benutzer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-caption text-on-surface-variant">{formatDateTime(l.created_at)}</td>
                                    <td className="px-4 py-3"><Badge>{l.action}</Badge></td>
                                    <td className="px-4 py-3 text-on-surface">{l.entity}</td>
                                    <td className="px-4 py-3 text-on-surface-variant truncate max-w-xs">{l.details || "–"}</td>
                                    <td className="px-4 py-3 font-mono text-caption text-on-surface-variant">{l.user_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
