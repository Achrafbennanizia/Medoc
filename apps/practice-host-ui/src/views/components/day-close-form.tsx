import { useCallback, useEffect, useMemo, useState } from "react";
import { listPayments, setPaymentsCashVerified } from "@/systems/practice-host/controllers/payment.controller";
import type { CreateDayCloseProtocol } from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { errorMessage, formatCurrency } from "@/lib/utils";
import {
    AMOUNT_TOL,
    amountsMatch,
    filterPaymentsForLocalDay,
    parseEuroInput,
    sumCashDay,
    sumIncomeDay,
} from "@/lib/day-close";
import type { Payment } from "@/models/types";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

function asOfDateDefault(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export type DayCloseProtocolExtra = {
    /** PDF daily report: all relevant B/U services for the date (aggregate), FA-FIN-INVOICE layout. */
    dailyReportPdf: boolean;
};

export type DayCloseFormProps = {
    canWrite: boolean;
    getPatientName: (patientId: string) => string;
    onRecord: (data: CreateDayCloseProtocol, extra: DayCloseProtocolExtra) => Promise<void>;
    /** When set, fixed date (display only). */
    fixedAsOfDate?: string;
    onCancel?: () => void;
    showCancelButton?: boolean;
    /** While create is running (page) */
    saveBusy?: boolean;
};

export function DayCloseForm({
    canWrite,
    getPatientName,
    onRecord,
    fixedAsOfDate,
    onCancel,
    showCancelButton,
    saveBusy = false,
}: DayCloseFormProps) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const timeLocale = locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-SA" : "en-US";
    const toast = useToastStore((s) => s.add);
    const [as_of_date, setAsOfDate] = useState(fixedAsOfDate ?? asOfDateDefault);
    const [countedRaw, setCountedRaw] = useState("");
    const [note, setNote] = useState("");
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [markBusy, setMarkBusy] = useState(false);
    const [dailyReportPdf, setDailyReportPdf] = useState(false);

    const load = useCallback(async () => {
        setLoadStatus("loading");
        setLoadError(null);
        try {
            setPayments(await listPayments());
            setLoadStatus("idle");
        } catch (e) {
            setLoadError(errorMessage(e));
            setLoadStatus("error");
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (fixedAsOfDate) setAsOfDate(fixedAsOfDate);
    }, [fixedAsOfDate]);

    const ymd = fixedAsOfDate ?? as_of_date;
    const onDay = useMemo(() => filterPaymentsForLocalDay(payments, ymd), [payments, ymd]);
    const systemCash = useMemo(() => sumCashDay(payments, ymd), [payments, ymd]);
    const systemIncome = useMemo(() => sumIncomeDay(payments, ymd), [payments, ymd]);

    const counted = useMemo(() => parseEuroInput(countedRaw), [countedRaw]);
    const showCompare = counted != null;
    const barMatch = showCompare && amountsMatch(counted!, systemCash);
    const barDelta = showCompare ? counted! - systemCash : 0;

    const idsToQuickMark = useMemo(
        () => onDay.filter((z) => z.status !== "CANCELLED" && (z.status === "PAID" || z.status === "PARTIALLY_PAID")).map((z) => z.id),
        [onDay],
    );
    const allAlreadyVerified =
        idsToQuickMark.length > 0 &&
        idsToQuickMark.every((id) => {
            const z = onDay.find((x) => x.id === id);
            return (z?.cash_verified ?? 0) === 1;
        });

    const cashVerifiedCount = useMemo(
        () => idsToQuickMark.filter((id) => (onDay.find((x) => x.id === id)?.cash_verified ?? 0) === 1).length,
        [idsToQuickMark, onDay],
    );

    const quickOptionVisible = canWrite && idsToQuickMark.length > 0;

    const markAll = async () => {
        if (!canWrite || idsToQuickMark.length === 0) return;
        setMarkBusy(true);
        try {
            await setPaymentsCashVerified(idsToQuickMark, true);
            await load();
            const count = idsToQuickMark.length;
            toast(
                count === 1
                    ? tp("page.day_close.toast.marked_one", { count })
                    : tp("page.day_close.toast.marked_many", { count }),
                "success",
            );
        } catch (e) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setMarkBusy(false);
        }
    };

    const buildPayload = (): CreateDayCloseProtocol => ({
        as_of_date: ymd,
        counted_eur: counted,
        system_cash_eur: systemCash,
        system_income_eur: systemIncome,
        variance_eur: showCompare ? barDelta : null,
        cash_matches: showCompare && barMatch ? 1 : 0,
        day_payment_count: idsToQuickMark.length,
        cash_verified_count: cashVerifiedCount,
        all_payments_verified: idsToQuickMark.length === 0 || allAlreadyVerified ? 1 : 0,
        note: note.trim() || null,
    });

    const protocol = async () => {
        try {
            await onRecord(buildPayload(), {
                dailyReportPdf,
            });
        } catch (e) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadStatus === "loading" ? (
                <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.form.loading_payments")}</p>
            ) : null}
            {loadStatus === "error" && loadError ? (
                <p style={{ color: "var(--danger, #c00)", margin: "0 0 12px" }} role="alert">
                    {loadError}
                </p>
            ) : null}

            <Input
                id="ts-as_of_date"
                type="date"
                label={t("page.day_close.form.as_of_date_label")}
                value={as_of_date}
                disabled={Boolean(fixedAsOfDate)}
                onChange={(e) => {
                    setAsOfDate(e.target.value);
                }}
            />

            <div className="card card-pad" style={{ background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.day_close.form.cash_system_title")}</p>
                <p style={{ margin: 0, fontSize: 15, color: "var(--fg-2)" }}>
                    {t("page.day_close.form.cash_system_desc")}{" "}
                    <strong style={{ color: "var(--fg-1)" }}>{formatCurrency(systemCash)}</strong>
                </p>
                <p className="page-sub" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                    {t("page.day_close.form.cash_system_income_ref")}{" "}
                    {formatCurrency(systemIncome)}
                </p>
            </div>

            <Input
                id="ts-counted"
                label={t("page.day_close.form.counted_label")}
                placeholder={t("page.day_close.form.counted_ph")}
                value={countedRaw}
                onChange={(e) => setCountedRaw(e.target.value)}
            />

            {showCompare ? (
                <div
                    className="card card-pad"
                    style={{
                        borderColor: barMatch ? "var(--accent, #0a6)" : "var(--border-2)",
                        background: barMatch ? "var(--success-soft, rgba(0, 120, 80, 0.12))" : "var(--warning-soft, rgba(180, 120, 0, 0.1))",
                    }}
                >
                    {barMatch ? (
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>
                            {t("page.day_close.form.match_ok")}
                        </p>
                    ) : (
                        <p style={{ margin: 0, fontSize: 15, color: "var(--fg-1)" }}>
                            <strong>{t("page.day_close.form.deviation_label")}</strong>{" "}
                            {barDelta > 0
                                ? tp("page.day_close.form.deviation_more", { amount: formatCurrency(barDelta) })
                                : tp("page.day_close.form.deviation_less", { amount: formatCurrency(-barDelta) })}
                        </p>
                    )}
                </div>
            ) : (
                <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                    {t("page.day_close.form.enter_count_hint")}
                </p>
            )}

            {quickOptionVisible ? (
                <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.day_close.form.cash_check_title")}</p>
                    <p className="page-sub" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
                        {t("page.day_close.form.cash_check_desc")}
                    </p>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void markAll()}
                            disabled={markBusy || allAlreadyVerified}
                            loading={markBusy}
                        >
                            {allAlreadyVerified
                                ? t("page.day_close.form.mark_all_done")
                                : tp("page.day_close.form.mark_all", { count: idsToQuickMark.length })}
                        </Button>
                    </div>
                </div>
            ) : null}

            <Textarea
                id="ts-note"
                label={t("page.day_close.form.remark_label")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
            />

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.day_close.form.pdf_option_title")}</p>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    {t("page.day_close.form.pdf_option_desc")}
                </p>
                <label className="row" style={{ gap: 10, alignItems: "center", fontSize: 14, color: "var(--fg-2)" }}>
                    <input
                        type="checkbox"
                        checked={dailyReportPdf}
                        onChange={(e) => {
                            setDailyReportPdf(e.target.checked);
                        }}
                    />
                    {t("page.day_close.form.pdf_checkbox")}
                </label>
            </div>

            <div>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.day_close.payments_title")}</p>
                {onDay.length === 0 ? (
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
                                {onDay.map((z) => (
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

            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                {tp("page.day_close.form.footer_hint", { tolerance: AMOUNT_TOL })}
            </p>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                {showCancelButton && onCancel ? (
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={saveBusy}>
                        {t("common.cancel")}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    onClick={() => void protocol()}
                    disabled={!canWrite || saveBusy}
                    loading={saveBusy}
                >
                    {t("page.day_close.form.submit")}
                </Button>
            </div>
        </div>
    );
}
