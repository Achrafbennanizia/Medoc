import { BREAK_GLASS_ENABLED } from "@/lib/mvp-security-config";
import { useCallback, useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { exportAuditCsv, listAuditLogsPaged } from "@/systems/practice-host/controllers/audit.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { buildAuditReportBundleFromCsv } from "@/lib/report-export";
import { ReportExportToolbar } from "@/views/components/report-export-toolbar";
import type { AuditLog } from "@/models/types";
import { totalPages, type ListResponse } from "@/lib/list-params";
import { Badge } from "@/views/components/ui/badge";
import { EmptyState } from "@/views/components/ui/empty-state";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { Button } from "@/views/components/ui/button";
import { WorkspacePageHeader } from "@/views/components/verwaltung-page-header";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export function AuditPage() {
    const t = useT();
    const tp = useTParams();
    const [resp, setResp] = useState<ListResponse<AuditLog> | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [breakGlassOnly, setBreakGlassOnly] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await listAuditLogsPaged({
                page,
                pageSize,
                filter: breakGlassOnly ? { breakGlassOnly: true } : undefined,
            });
            setResp(data);
        } catch (e) {
            setLoadError(errorMessage(e));
            setResp(null);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, breakGlassOnly]);

    useEffect(() => {
        void load();
    }, [load]);

    const total = resp?.total ?? 0;

    const buildExportBundle = useCallback(async () => {
        const bytes = await exportAuditCsv();
        const text = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
        return buildAuditReportBundleFromCsv(text, total);
    }, [total]);

    const logs = resp?.items ?? [];
    const pages = resp ? totalPages(resp) : 1;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <WorkspacePageHeader
                title={t("audit.page.title")}
                subtitle={tp("audit.page.subtitle", { max: PAGE_SIZE_MAX })}
                back={{ to: "/", label: t("breadcrumb.dashboard") }}
            />

            <div className="page-toolbar" style={{ alignItems: "center" }}>
                <div className="page-toolbar__filters row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 13, color: "var(--fg-3)", flexShrink: 0 }}>
                        {t("audit.page.rows")}
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
                    {BREAK_GLASS_ENABLED ? (
                    <label className="row" style={{ gap: 6, alignItems: "center", fontSize: 13, color: "var(--fg-3)" }}>
                        <input
                            type="checkbox"
                            checked={breakGlassOnly}
                            onChange={(e) => {
                                setBreakGlassOnly(e.target.checked);
                                setPage(1);
                            }}
                        />
                        {t("audit.page.break_glass_only")}
                    </label>
                    ) : null}
                    <ReportExportToolbar
                        dialogTitle={t("audit.page.export_title")}
                        buildBundle={buildExportBundle}
                        defaultFormat="pdf"
                        disabled={total === 0 || !!loadError}
                        showImport
                    />
                </div>
            </div>

            {!loading && !loadError && total > 0 ? (
                <p className="page-sub" style={{ margin: 0 }}>
                    {tp("audit.page.summary", {
                        total,
                        pageInfo: logs.length > 0 ? tp("audit.page.summary_page", { page, pages }) : "",
                    })}
                </p>
            ) : null}

            {loading ? (
                <PageLoading label={t("audit.page.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : total === 0 ? (
                <EmptyState icon="📋" title={t("audit.page.empty")} />
            ) : (
                <div className="card tbl-data-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("audit.page.col_time")}</th><th>{t("audit.page.col_action")}</th><th>{t("audit.page.col_entity")}</th><th>{t("audit.page.col_details")}</th><th>{t("audit.page.col_emergency")}</th><th>{t("audit.page.col_user")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id}>
                                    <td>{formatDateTime(l.created_at)}</td>
                                    <td><Badge>{l.action}</Badge></td>
                                    <td>{l.entity}</td>
                                    <td>{l.details || "–"}</td>
                                    <td>
                                        {l.under_break_glass ? (
                                            <span title={l.break_glass_reason ?? undefined}>
                                                <Badge variant="warning">{t("audit.page.break_glass_badge")}</Badge>
                                            </span>
                                        ) : (
                                            "–"
                                        )}
                                    </td>
                                    <td
                                        className="tbl-col-mono"
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
                            {tp("audit.page.page_of", { page, pages })}
                        </span>
                        <div className="row" style={{ gap: 8 }}>
                            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                {t("common.back")}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                                {t("common.next")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
