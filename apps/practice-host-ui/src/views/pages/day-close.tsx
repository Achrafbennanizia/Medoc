import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayCloseProtocolExtra } from "../components/day-close-form";
import { useNavigate } from "react-router-dom";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import {
    createDayCloseProtocol,
    deleteDayCloseProtocol,
    listDayCloseProtocols,
    type CreateDayCloseProtocol,
    type DayCloseProtocol,
} from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { listPaymentsPaged } from "@/systems/practice-host/controllers/payment.controller";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { paymentLocalYmd } from "@/lib/day-close";
import { downloadDayCloseReportPdf } from "@/lib/day-close-invoice-pdf";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Patient, Payment } from "@/models/types";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { DayCloseForm } from "../components/day-close-form";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { LAZY_PAGE_SIZE, mergeUniqueById } from "@/lib/lazy-list";

async function loadAllPaymentsPaged(): Promise<Payment[]> {
    let page = 1;
    let all: Payment[] = [];
    let total = Infinity;
    while (all.length < total) {
        const resp = await listPaymentsPaged({ page, pageSize: LAZY_PAGE_SIZE });
        total = resp.total;
        all = mergeUniqueById(all, resp.items);
        if (resp.items.length === 0 || page * resp.pageSize >= total) break;
        page += 1;
        // Safety: don't loop forever on pathological totals
        if (page > 200) break;
    }
    return all;
}

/**
 * DayClose — list of logged closings + new run / detail (cash reconciliation).
 */
export function DayClosePage() {
    const navigate = useNavigate();
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const timeLocale = locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-SA" : "en-US";
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canRead = role != null && allowed("finance.read", role);
    const canWrite = role != null && allowed("finance.day_close.write", role);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [protocols, setProtocols] = useState<DayCloseProtocol[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<DayCloseProtocol | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const getPatientName = useCallback(
        (pid: string) => patients.find((p) => p.id === pid)?.name ?? pid,
        [patients],
    );

    const readField = useCallback(
        (label: string, value: string) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                const [prots, zahls] = await Promise.all([listDayCloseProtocols(), loadAllPaymentsPaged()]);
                const ids = [...new Set(zahls.map((z) => z.patient_id).filter(Boolean))];
                const pats = ids.length ? await listPatientsByIds(ids) : [];
                setPatients(pats);
                setProtocols(prots);
                setPayments(zahls);
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

    const onRecord = async (data: CreateDayCloseProtocol, extra: DayCloseProtocolExtra) => {
        if (!canWrite) return;
        setSaveBusy(true);
        try {
            const created = await createDayCloseProtocol(data);
            toast(t("page.day_close.toast.saved"), "success");
            if (extra.dailyReportPdf) {
                try {
                    await downloadDayCloseReportPdf(created, payments, patients);
                    toast(t("page.day_close.toast.pdf_ok"), "success");
                } catch (e) {
                    toast(tp("page.day_close.toast.pdf_fail", { message: errorMessage(e) }), "error");
                }
            }
            setCreating(false);
            void load();
            setSelected(created);
        } finally {
            setSaveBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;
        try {
            await deleteDayCloseProtocol(id);
            toast(t("page.day_close.toast.removed"), "success");
            setDeleteId(null);
            setSelected((s) => (s?.id === id ? null : s));
            void load();
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    };

    const handlePrintProtocol = useCallback(() => {
        document.body.classList.add("day_close-printing");
        const clear = () => {
            document.body.classList.remove("day_close-printing");
        };
        window.addEventListener("afterprint", clear, { once: true });
        window.setTimeout(clear, 60_000);
        window.print();
    }, []);

    const openCreate = () => {
        setCreating(true);
        setSelected(null);
    };

    const paymentsAmAsOfDate = useMemo(() => {
        if (!selected) return [] as Payment[];
        return payments.filter((z) => paymentLocalYmd(z.created_at) === selected.as_of_date);
    }, [payments, selected]);

    if (!canRead) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in">
                <AdministrationPageHeader title={t("page.day_close.title")} subtitle={t("page.day_close.no_permission")} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in">
                <AdministrationPageHeader title={t("page.day_close.title")} />
                <PageLoading label={t("page.day_close.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="day_close-page practice-workspace-page animate-fade-in">
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
                            getPatientName={getPatientName}
                            onRecord={onRecord}
                            onCancel={() => setCreating(false)}
                            showCancelButton
                            saveBusy={saveBusy}
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
                            <div className="row day_close-no-print" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                        void downloadDayCloseReportPdf(selected, payments, patients).catch((e) =>
                                            toast(tp("page.day_close.toast.pdf_fail", { message: errorMessage(e) }), "error"),
                                        )
                                    }
                                >
                                    {t("page.day_close.report_pdf")}
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={handlePrintProtocol}>
                                    {t("page.day_close.print")}
                                </Button>
                                {canWrite ? (
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(selected.id)}>
                                        {t("page.day_close.remove_entry")}
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="products-read-grid">
                            {readField(t("page.day_close.field.as_of_date"), formatDate(selected.as_of_date))}
                            {readField(t("page.day_close.field.recorded"), formatDateTime(selected.recorded_at))}
                            {readField(t("page.day_close.field.bar_system"), formatCurrency(selected.system_cash_eur))}
                            {readField(t("page.day_close.field.income_system"), formatCurrency(selected.system_income_eur))}
                            {readField(t("page.day_close.field.counted"), selected.counted_eur == null ? "—" : formatCurrency(selected.counted_eur))}
                            {readField(t("page.day_close.field.deviation"), selected.variance_eur == null ? "—" : formatCurrency(selected.variance_eur))}
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
                            {paymentsAmAsOfDate.length === 0 ? (
                                <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.no_payments")}</p>
                            ) : (
                                <div className="card" style={{ overflow: "auto", maxHeight: 220 }}>
                                    <table className="tbl" style={{ minWidth: 400, fontSize: 13, margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "left" }}>{t("common.time")}</th>
                                                <th style={{ textAlign: "left" }}>{t("common.patient")}</th>
                                                <th>{t("page.day_close.col.kind")}</th>
                                                <th>{t("common.status")}</th>
                                                <th style={{ textAlign: "end" }}>€</th>
                                                <th>{t("page.day_close.col.cash_checked")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentsAmAsOfDate.map((z) => (
                                                <tr key={z.id}>
                                                    <td>
                                                        {new Date(z.created_at.trim().replace(" ", "T")).toLocaleTimeString(timeLocale, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>
                                                    <td style={{ maxWidth: 120 }} title={getPatientName(z.patient_id)}>
                                                        {getPatientName(z.patient_id).slice(0, 24)}
                                                    </td>
                                                    <td>{z.payment_method}</td>
                                                    <td>{z.status}</td>
                                                    <td style={{ textAlign: "end" }}>{formatCurrency(z.amount)}</td>
                                                    <td style={{ textAlign: "center" }}>{(z.cash_verified ?? 0) === 1 ? "✓" : "—"}</td>
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
        <div className="day_close-page practice-workspace-page animate-fade-in">
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
                                        <th style={{ textAlign: "left" }}>{t("page.day_close.col.as_of_date")}</th>
                                        <th style={{ textAlign: "left" }}>{t("page.day_close.col.recorded")}</th>
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
                                                <td>{formatDate(row.as_of_date)}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.recorded_at)}</td>
                                                <td style={{ textAlign: "end" }}>{formatCurrency(row.system_cash_eur)}</td>
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

            <ConfirmDialog
                open={deleteId != null}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.day_close.delete.title")}
                message={t("page.day_close.delete.message")}
                danger
            />
        </div>
    );
}
