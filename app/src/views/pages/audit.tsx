import { useCallback, useEffect, useState } from "react";
import { exportAuditCsv, listAuditLogsPaged } from "../../controllers/audit.controller";
import { errorMessage, formatDateTime } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import type { AuditLog } from "../../models/types";
import { totalPages, type ListResponse } from "../../lib/list-params";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { Button } from "../components/ui/button";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export function AuditPage() {
    const toast = useToastStore((s) => s.add);
    const [resp, setResp] = useState<ListResponse<AuditLog> | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await listAuditLogsPaged({ page, pageSize });
            setResp(data);
        } catch (e) {
            setLoadError(errorMessage(e));
            setResp(null);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

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

    const logs = resp?.items ?? [];
    const total = resp?.total ?? 0;
    const pages = resp ? totalPages(resp) : 1;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div>
                    <h2 className="page-title">Audit-Log</h2>
                    <p className="page-sub" style={{ marginTop: 4 }}>
                        Seitenweise Ansicht (max. {PAGE_SIZE_MAX} Einträge pro Seite). Export bleibt vollständig.
                    </p>
                </div>
            </div>

            <div className="page-toolbar" style={{ alignItems: "center" }}>
                <div className="page-toolbar__filters row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 13, color: "var(--fg-3)", flexShrink: 0 }}>
                        Zeilen
                        <select
                            className="input-edit"
                            style={{ width: 88, padding: "6px 8px" }}
                            value={pageSize}
                            onChange={(e) => {
                                setPage(1);
                                setPageSize(Number.parseInt(e.target.value, 10) || PAGE_SIZE_DEFAULT);
                            }}
                        >
                            {[25, 50, 100, 200].filter((n) => n <= PAGE_SIZE_MAX).map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={() => void exportCsv()}
                        disabled={busy || total === 0 || !!loadError}
                        className="btn btn-subtle"
                    >
                        {busy ? "Export…" : "CSV exportieren"}
                    </button>
                </div>
            </div>

            {!loading && !loadError && total > 0 ? (
                <p className="page-sub" style={{ margin: 0 }}>
                    {total} Einträge gesamt{logs.length > 0 ? ` · Seite ${page} / ${pages}` : ""}
                </p>
            ) : null}

            {loading ? (
                <PageLoading label="Audit-Einträge werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : total === 0 ? (
                <EmptyState icon="📋" title="Keine Audit-Einträge" />
            ) : (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div className="tbl-scroll">
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
                    <div
                        className="card-pad row"
                        style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line)" }}
                    >
                        <span style={{ color: "var(--fg-3)", fontSize: 13 }}>
                            Seite {page} / {pages}
                        </span>
                        <div className="row" style={{ gap: 8 }}>
                            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                Zurück
                            </Button>
                            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                                Weiter
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
