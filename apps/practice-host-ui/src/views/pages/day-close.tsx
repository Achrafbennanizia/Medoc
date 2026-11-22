import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    correctDayClose,
    dayCloseReportCopy,
    listDayCloseProtocols,
    prepareDayClose,
    type DayCloseDraft,
    type DayCloseProtocolExt,
    type DayCloseResult,
} from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { issuedPdfBytes, type IssuedPdf } from "@/systems/practice-host/controllers/document.controller";
import { openExportPreview } from "@/models/store/export-preview-store";
import { errorMessage, formatDate, formatDateTime, formatDbTime, parseEuroInput } from "@/lib/utils";
import { formatCashAmount } from "@/lib/day-close";
import { practiceCurrency } from "@/lib/practice-currency";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { DayCloseForm } from "../components/day-close-form";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { Dialog } from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";

/**
 * DayClose — list of logged closings + new run / detail (cash reconciliation).
 */
export function DayClosePage() {
    const navigate = useNavigate();
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canRead = role != null && allowed("finance.read", role);
    const canWrite = role != null && allowed("finance.day_close.write", role);

    const [protocols, setProtocols] = useState<DayCloseProtocolExt[]>([]);
    const [selectedDraft, setSelectedDraft] = useState<DayCloseDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<DayCloseProtocolExt | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [correctOpen, setCorrectOpen] = useState(false);
    const [correctCounted, setCorrectCounted] = useState("");
    const [correctNote, setCorrectNote] = useState("");
    const [reportBusy, setReportBusy] = useState(false);

    const readField = useCallback(
        (label: string, value: string) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span className="kpi-label-mini">{label}</span>
                <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value || "—"}</span>
            </div>
        ),
        [],
    );

    const load = useCallback(
        async (initial?: boolean) => {
            if (initial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                // Only the protocols; journal lines are loaded per closing.
                const prots = (await listDayCloseProtocols()) as DayCloseProtocolExt[];
                setProtocols(prots);
                setSelected((cur) => {
                    if (!cur) return null;
                    return prots.find((x) => x.id === cur.id) ?? null;
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (initial) setLoadError(msg);
                else toast(tp("common.refresh_failed", { message: msg }), "error");
            } finally {
                if (initial) setLoading(false);
            }
        },
        [toast, tp],
    );

    useEffect(() => {
        if (!canRead) return;
        void load(true);
    }, [load, canRead]);

    const showReport = useCallback(
        (pdf: IssuedPdf, date: string) => {
            try {
                const copySuffix = pdf.reprint ? `-${t("page.day_close.pdf_file_copy")}` : "";
                openExportPreview({
                    format: "pdf",
                    title: `${t("page.day_close.report_title")} ${pdf.documentNumber ?? ""}`.trim(),
                    hint: pdf.reprint ? t("page.day_close.pdf_hint_copy") : undefined,
                    suggestedFilename: `${t("page.day_close.pdf_filename")}-${date}${copySuffix}.pdf`,
                    binaryBody: issuedPdfBytes(pdf),
                    context: { kind: "daily_report", format: "pdf", entityId: date, documentNumber: pdf.documentNumber },
                });
            } catch (e) {
                toast(tp("page.day_close.toast.pdf_fail", { message: errorMessage(e) }), "error");
            }
        },
        [t, toast, tp],
    );

    /** Closing recorded on the server; show the numbered cash report in Export Preview. */
    const onClosed = async (result: DayCloseResult) => {
        toast(t("page.day_close.toast.saved"), "success");
        showReport(result.report, result.draft.asOfDate);
        setCreating(false);
        const fresh = await listDayCloseProtocols().catch(() => [] as DayCloseProtocolExt[]);
        setProtocols(fresh);
        setSelected(fresh.find((p) => p.id === result.protocolId) ?? null);
    };

    const openCashReport = useCallback(
        async (protocolId: string, date: string) => {
            if (reportBusy) return;
            setReportBusy(true);
            try {
                const pdf = await dayCloseReportCopy(protocolId);
                showReport(pdf, date);
            } catch (e) {
                toast(tp("page.day_close.toast.pdf_fail", { message: errorMessage(e) }), "error");
            } finally {
                setReportBusy(false);
            }
        },
        [reportBusy, showReport, toast, tp],
    );

    const latestFinalId = useMemo(
        () =>
            [...protocols]
                .filter((p) => (p.status ?? "FINAL") === "FINAL")
                .sort((a, b) => b.as_of_date.localeCompare(a.as_of_date))[0]?.id ?? null,
        [protocols],
    );

    const submitCorrection = async () => {
        if (!selected) return;
        const v = parseEuroInput(correctCounted);
        if (v == null || !correctNote.trim()) return;
        setSaveBusy(true);
        try {
            const res = await correctDayClose(selected.id, {
                countedCents: Math.round(v * 100),
                note: correctNote.trim(),
            });
            setCorrectOpen(false);
            setCorrectCounted("");
            setCorrectNote("");
            await onClosed(res);
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setSaveBusy(false);
        }
    };

    const handlePrintProtocol = useCallback(() => {
        if (!selected) return;
        void openCashReport(selected.id, selected.as_of_date);
    }, [openCashReport, selected]);

    const openCreate = () => {
        setCreating(true);
        setSelected(null);
    };

    const selectedId = selected?.id;
    const selectedAsOf = selected?.as_of_date;
    useEffect(() => {
        if (!selectedAsOf) {
            setSelectedDraft(null);
            return;
        }
        let cancel = false;
        void prepareDayClose(selectedAsOf)
            .then((d) => {
                if (!cancel) setSelectedDraft(d);
            })
            .catch(() => {
                if (!cancel) setSelectedDraft(null);
            });
        return () => {
            cancel = true;
        };
        // Re-prepare only when another protocol (or its date) is selected, not on every object refresh.
    }, [selectedId, selectedAsOf]);

    if (!canRead) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in--sticky-safe">
                <AdministrationPageHeader title={t("page.day_close.title")} subtitle={t("page.day_close.no_permission")} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in--sticky-safe">
                <AdministrationPageHeader title={t("page.day_close.title")} />
                <PageLoading label={t("page.day_close.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in--sticky-safe">
                <AdministrationPageHeader title={t("page.day_close.title")} />
                <PageLoadError message={loadError} onRetry={() => void load(true)} />
            </div>
        );
    }

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="products-detail-card day_close-read-print">
                    <CardHeader
                        title={t("page.day_close.new_title")}
                        subtitle={t("page.day_close.new_subtitle")}
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={saveBusy} className="day_close-no-print">
                                {t("common.close")}
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <DayCloseForm
                            canWrite={canWrite}
                            onClosed={(r) => void onClosed(r)}
                            onCancel={() => setCreating(false)}
                            showCancelButton
                        />
                    </div>
                </Card>
            );
        }
        if (selected) {
            const barOk = selected.cash_matches === 1;
            const allOk = selected.all_payments_verified === 1;
            return (
                <Card className="products-detail-card day_close-read-print">
                    <CardHeader
                        title={formatDate(selected.as_of_date)}
                        subtitle={tp("page.day_close.detail.subtitle", { date: formatDateTime(selected.recorded_at) })}
                        action={(
                            <div className="row day_close-no-print" style={{ gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    loading={reportBusy}
                                    disabled={reportBusy}
                                    onClick={() => void openCashReport(selected.id, selected.as_of_date)}
                                >
                                    {t("page.day_close.report_copy")}
                                </Button>
                                <Button type="button" size="sm" variant="secondary" disabled={reportBusy} onClick={handlePrintProtocol}>
                                    {t("page.day_close.print")}
                                </Button>
                                {canWrite && selected.id === latestFinalId ? (
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setCorrectOpen(true)}>
                                        {t("page.day_close.correct_btn")}
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="products-read-grid">
                            {readField(t("page.day_close.field.as_of_date"), formatDate(selected.as_of_date))}
                            {readField(t("page.day_close.field.recorded"), formatDateTime(selected.recorded_at))}
                            {readField(t("page.day_close.field.document"), selected.document_number ?? "—")}
                            {readField(
                                t("common.status"),
                                (selected.status ?? "FINAL") === "CORRECTED"
                                    ? t("page.day_close.status.corrected")
                                    : t("page.day_close.status.final"),
                            )}
                            {selected.opening_cents != null
                                ? readField(t("page.day_close.form.opening"), formatCashAmount(selected.opening_cents / 100))
                                : null}
                            {selected.closed_by_name ? readField(t("page.day_close.field.closed_by"), selected.closed_by_name) : null}
                            {readField(t("page.day_close.field.bar_system"), formatCashAmount(selected.system_cash_eur))}
                            {readField(t("page.day_close.field.income_system"), formatCashAmount(selected.system_income_eur))}
                            {readField(t("page.day_close.field.counted"), selected.counted_eur == null ? "—" : formatCashAmount(selected.counted_eur))}
                            {readField(t("page.day_close.field.deviation"), selected.variance_eur == null ? "—" : formatCashAmount(selected.variance_eur))}
                            {readField(t("page.day_close.field.bar_match"), barOk ? t("page.day_close.bar_ok") : t("page.day_close.bar_match_bad"))}
                            {readField(
                                t("page.day_close.field.day_payments"),
                                tp("page.day_close.day_payments_detail", {
                                    total: selected.day_payment_count,
                                    checked: selected.cash_verified_count,
                                    allOk: allOk ? t("common.yes") : t("common.no"),
                                }),
                            )}
                        </div>
                        {selected.note ? readField(t("page.day_close.field.remark"), selected.note) : null}

                        <div>
                            <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.day_close.payments_title")}</p>
                            <p className="page-sub" style={{ margin: "0 0 8px", fontSize: 12 }}>{t("page.day_close.payments_hint")}</p>
                            {!selectedDraft || (selectedDraft.receipts.length === 0 && selectedDraft.movements.length === 0) ? (
                                <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.no_payments")}</p>
                            ) : (
                                <div className="card" style={{ overflow: "auto", maxHeight: 260 }}>
                                    <table className="tbl" style={{ minWidth: 420, fontSize: 13, margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "start" }}>{t("common.time")}</th>
                                                <th style={{ textAlign: "start" }}>{t("page.day_close.col.entry")}</th>
                                                <th>{t("page.day_close.col.kind")}</th>
                                                <th>{t("page.day_close.col.voucher")}</th>
                                                <th style={{ textAlign: "end" }}>{practiceCurrency()}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDraft.receipts.map((r) => (
                                                <tr key={r.id}>
                                                    <td style={{ whiteSpace: "nowrap" }}>
                                                        {formatDbTime(r.receivedAt, locale)}
                                                    </td>
                                                    <td>{(r.patientName ?? r.patientId.slice(0, 8)).slice(0, 28)}</td>
                                                    <td>{t(`page.day_close.method.${r.method.toLowerCase()}`)}</td>
                                                    <td>{r.receiptNumber ?? "—"}</td>
                                                    <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{formatCashAmount(r.amountCents / 100)}</td>
                                                </tr>
                                            ))}
                                            {selectedDraft.movements.map((m) => (
                                                <tr key={m.id}>
                                                    <td style={{ whiteSpace: "nowrap" }}>
                                                        {formatDbTime(m.occurredAt, locale)}
                                                    </td>
                                                    <td>{`${t(`page.day_close.movement.kind.${m.kind.toLowerCase()}`)}: ${m.reason}`}</td>
                                                    <td>{t("page.day_close.method.cash")}</td>
                                                    <td>{m.receiptRef ?? "—"}</td>
                                                    <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
                                                        {formatCashAmount((m.amountCents * m.direction) / 100)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="products-detail-card">
                <div className="card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    <EmptyState
                        title={t("page.day_close.no_selection.title")}
                        description={t("page.day_close.no_selection.desc")}
                    />
                </div>
            </Card>
        );
    })();

    return (
        <div className="day_close-page practice-workspace-page animate-fade-in--sticky-safe">
            <AdministrationPageHeader
                className="day_close-no-print"
                titleLevel="h1"
                title={t("page.day_close.title")}
                subtitle={
                    <>
                        {t("page.day_close.subtitle_part1")}{" "}
                        <strong>{t("breadcrumb.finance_reports")}</strong>{" "}
                        {t("page.day_close.subtitle_suffix")}{" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/administration/finance-reports/invoice")}
                        >
                            {t("breadcrumb.invoice_pdf")}
                        </button>
                        .
                    </>
                }
                actions={
                    canWrite ? (
                        <Button
                            type="button"
                            variant={creating ? "secondary" : "primary"}
                            onClick={creating ? () => setCreating(false) : openCreate}
                        >
                            {creating ? t("page.day_close.new_cancel_btn") : t("page.day_close.new_btn")}
                        </Button>
                    ) : null
                }
            />

            <div className="products-workspace">
                <div className="products-workspace__list day_close-protocol-list">
                    {!canWrite ? (
                        <p className="page-sub" style={{ fontSize: 13, margin: "0 0 8px" }}>{t("page.day_close.write_hint")}</p>
                    ) : null}
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>{t("page.day_close.protocols")}</p>
                    {protocols.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.empty_protocols")}</p>
                    ) : (
                        <div className="card" style={{ overflow: "auto" }}>
                            <table className="tbl" style={{ minWidth: 400, fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "start" }}>{t("page.day_close.col.as_of_date")}</th>
                                        <th style={{ textAlign: "start" }}>{t("page.day_close.col.recorded")}</th>
                                        <th style={{ textAlign: "end" }}>{t("page.day_close.col.bar_system")}</th>
                                        <th>{t("page.day_close.col.bar_match")}</th>
                                        <th>{t("page.day_close.col.day_payments")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {protocols.map((row) => {
                                        const isSel = selected?.id === row.id && !creating;
                                        return (
                                            <tr
                                                key={row.id}
                                                className={isSel ? "products-row--selected" : undefined}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => {
                                                    setCreating(false);
                                                    setSelected(row);
                                                }}
                                            >
                                                <td>
                                                    {formatDate(row.as_of_date)}
                                                    {(row.status ?? "FINAL") === "CORRECTED" ? (
                                                        <span className="pill" style={{ marginInlineStart: "var(--space-2)", fontSize: 11 }}>
                                                            {t("page.day_close.status.corrected")}
                                                        </span>
                                                    ) : null}
                                                    {row.document_number ? (
                                                        <div className="page-sub" style={{ fontSize: 11 }}>{row.document_number}</div>
                                                    ) : null}
                                                </td>
                                                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.recorded_at)}</td>
                                                <td style={{ textAlign: "end" }}>{formatCashAmount(row.system_cash_eur)}</td>
                                                <td>{row.cash_matches === 1 ? t("page.day_close.bar_ok") : t("page.day_close.bar_check")}</td>
                                                <td>
                                                    {row.day_payment_count}
                                                    {" "}
                                                    /
                                                    {" "}
                                                    {row.cash_verified_count}
                                                    {" "}
                                                    {t("page.day_close.checked_short")}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="products-workspace__detail">{sidePanel}</div>
            </div>

            <Dialog
                open={correctOpen}
                onClose={() => setCorrectOpen(false)}
                title={t("page.day_close.correct_title")}
                footer={
                    <div className="modal-actions" style={{ justifyContent: "flex-end", gap: "var(--space-2)" }}>
                        <Button type="button" variant="ghost" onClick={() => setCorrectOpen(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void submitCorrection()}
                            disabled={saveBusy || parseEuroInput(correctCounted) == null || !correctNote.trim()}
                            loading={saveBusy}
                        >
                            {t("page.day_close.correct_confirm")}
                        </Button>
                    </div>
                }
            >
                <div className="modal-body stack gap-3" style={{ maxWidth: 480 }}>
                    <p style={{ margin: 0, fontSize: 13 }}>{t("page.day_close.correct_hint")}</p>
                    <Input
                        id="dc-correct-counted"
                        label={t("page.day_close.form.counted_label")}
                        value={correctCounted}
                        onChange={(e) => setCorrectCounted(e.target.value)}
                    />
                    <Textarea
                        id="dc-correct-note"
                        label={t("page.day_close.form.reason_required")}
                        rows={3}
                        value={correctNote}
                        onChange={(e) => setCorrectNote(e.target.value)}
                    />
                </div>
            </Dialog>
        </div>
    );
}
