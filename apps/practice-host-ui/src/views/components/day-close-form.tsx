import { useCallback, useEffect, useMemo, useState } from "react";
import { setPaymentsCashVerified } from "@/systems/practice-host/controllers/payment.controller";
import {
    EURO_DENOMINATIONS,
    closeDay,
    movementSignedCents,
    prepareDayClose,
    recordCashMovement,
    type CashMovementKind,
    type DayCloseDraft,
    type DayCloseResult,
} from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { errorMessage, formatDate } from "@/lib/utils";
import { formatCashAmount, parseDbUtc, parseEuroInput } from "@/lib/day-close";
import { practiceCurrency } from "@/lib/practice-currency";
import { bcp47ForLocale, useLocale, useT, useTParams } from "@/lib/i18n";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { Input, Select, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const eur = (cents: number) => formatCashAmount(cents / 100);
const toCents = (raw: string): number | null => {
    const v = parseEuroInput(raw);
    return v == null ? null : Math.round(v * 100);
};

export type DayCloseFormProps = {
    canWrite: boolean;
    /** Called after the closing was recorded and the Kassenbericht issued. */
    onClosed: (result: DayCloseResult) => void;
    onCancel?: () => void;
    showCancelButton?: boolean;
};

/**
 * Kassenabschluss: every figure comes from the server (cash journal). The
 * person enters what was counted (total or per denomination), the card
 * terminal total and, for any difference, the reason. Recording is final.
 */
export function DayCloseForm({ canWrite, onClosed, onCancel, showCancelButton }: DayCloseFormProps) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const timeLocale = bcp47ForLocale(locale);
    const toast = useToastStore((s) => s.add);

    const [asOfDate, setAsOfDate] = useState(todayLocal);
    const [draft, setDraft] = useState<DayCloseDraft | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [byDenomination, setByDenomination] = useState(true);
    const [denoms, setDenoms] = useState<Record<string, string>>({});
    const [countedRaw, setCountedRaw] = useState("");
    const [terminalRaw, setTerminalRaw] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    // Cash movement entry
    const [mvKind, setMvKind] = useState<Exclude<CashMovementKind, "REVERSAL">>("BANK_DEPOSIT");
    const [mvAmount, setMvAmount] = useState("");
    const [mvReason, setMvReason] = useState("");
    const [mvVoucher, setMvVoucher] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setDraft(await prepareDayClose(asOfDate));
        } catch (e) {
            setDraft(null);
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [asOfDate]);

    useEffect(() => {
        void load();
    }, [load]);

    const countedCents = useMemo(() => {
        if (byDenomination) {
            let sum = 0;
            let any = false;
            for (const d of EURO_DENOMINATIONS) {
                const n = Number.parseInt(denoms[String(d)] ?? "", 10);
                if (Number.isFinite(n) && n > 0) {
                    sum += n * d;
                    any = true;
                }
            }
            return any ? sum : null;
        }
        return toCents(countedRaw);
    }, [byDenomination, denoms, countedRaw]);

    const terminalCents = useMemo(() => (terminalRaw.trim() ? toCents(terminalRaw) : null), [terminalRaw]);
    const variance = draft && countedCents != null ? countedCents - draft.expectedCents : null;
    const cardVariance = draft && terminalCents != null ? terminalCents - draft.cardCents : null;
    const needsNote = (variance != null && variance !== 0) || (cardVariance != null && cardVariance !== 0);
    const canClose =
        canWrite && draft != null && !draft.alreadyClosed && countedCents != null && (!needsNote || note.trim().length > 0);

    const cashPaymentIds = useMemo(
        () => [...new Set((draft?.receipts ?? []).filter((r) => r.method === "CASH" && r.amountCents > 0).map((r) => r.paymentId))],
        [draft],
    );

    const markVerified = async () => {
        if (cashPaymentIds.length === 0) return;
        setBusy(true);
        try {
            await setPaymentsCashVerified(cashPaymentIds, true);
            await load();
        } catch (e) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const addMovement = async () => {
        const cents = toCents(mvAmount);
        if (cents == null || cents <= 0 || !mvReason.trim()) {
            toast(t("page.day_close.movement.invalid"), "error");
            return;
        }
        setBusy(true);
        try {
            await recordCashMovement({ kind: mvKind, amountCents: cents, reason: mvReason.trim(), receiptRef: mvVoucher.trim() || null });
            setMvAmount("");
            setMvReason("");
            setMvVoucher("");
            toast(t("page.day_close.movement.saved"), "success");
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const submit = async () => {
        if (!draft || countedCents == null) return;
        setConfirmOpen(false);
        setBusy(true);
        try {
            const denominations = byDenomination
                ? Object.fromEntries(
                      Object.entries(denoms)
                          .map(([k, v]) => [k, Number.parseInt(v, 10)] as const)
                          .filter(([, n]) => Number.isFinite(n) && n > 0),
                  )
                : null;
            const result = await closeDay({
                asOfDate: draft.asOfDate,
                countedCents: byDenomination ? null : countedCents,
                denominations,
                cardTerminalCents: terminalCents,
                note: note.trim() || null,
            });
            onClosed(result);
        } catch (e) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const time = (utc: string) =>
        parseDbUtc(utc).toLocaleString(timeLocale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const row = (label: string, value: string, strong = false) => (
        <div className="row" style={{ justifyContent: "space-between", gap: 12, fontSize: 14 }}>
            <span style={{ color: "var(--fg-2)" }}>{label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 700 : 500, color: "var(--fg-1)" }}>{value}</span>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
                id="dc-date"
                type="date"
                label={t("page.day_close.form.as_of_date_label")}
                value={asOfDate}
                max={todayLocal()}
                onChange={(e) => setAsOfDate(e.target.value)}
            />
            {loading ? <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.form.loading_payments")}</p> : null}
            {loadError ? (
                <p style={{ color: "var(--danger, #c00)", margin: 0 }} role="alert">
                    {loadError}
                </p>
            ) : null}

            {draft ? (
                <>
                    {draft.alreadyClosed ? (
                        <p className="card card-pad" style={{ margin: 0, fontSize: 14 }} role="status">
                            {t("page.day_close.form.already_closed")}
                        </p>
                    ) : null}
                    {draft.lateCount > 0 && !draft.alreadyClosed ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                            {tp("page.day_close.form.late_entries", { count: draft.lateCount, from: formatDate(draft.periodFrom) })}
                        </p>
                    ) : null}

                    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-1)" }}>
                        <p className="text-title" style={{ margin: "0 0 4px", fontSize: 14 }}>{t("page.day_close.form.cash_book_title")}</p>
                        {row(
                            draft.lastClose?.documentNumber
                                ? tp("page.day_close.form.opening_from", { number: draft.lastClose.documentNumber })
                                : t("page.day_close.form.opening"),
                            eur(draft.openingCents),
                        )}
                        {row(t("page.day_close.form.cash_receipts"), eur(draft.cashReceiptsCents))}
                        {row(t("page.day_close.form.cash_movements"), eur(draft.cashMovementsCents))}
                        {row(t("page.day_close.form.expected"), eur(draft.expectedCents), true)}
                        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "6px 0" }} />
                        {row(t("page.day_close.form.card_total"), eur(draft.cardCents))}
                        {row(t("page.day_close.form.transfer_total"), eur(draft.transferCents))}
                    </div>

                    {draft.unverifiedCount > 0 && canWrite && !draft.alreadyClosed ? (
                        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                                {tp("page.day_close.form.unverified", { count: draft.unverifiedCount })}
                            </p>
                            <div>
                                <Button type="button" size="sm" variant="secondary" onClick={() => void markVerified()} disabled={busy}>
                                    {t("page.day_close.form.mark_verified")}
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    <div>
                        <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.day_close.payments_title")}</p>
                        {draft.receipts.length === 0 && draft.movements.length === 0 ? (
                            <p className="page-sub" style={{ margin: 0 }}>{t("page.day_close.no_payments")}</p>
                        ) : (
                            <div className="card" style={{ overflow: "auto", maxHeight: 260 }}>
                                <table className="tbl" style={{ minWidth: 460, fontSize: 13, margin: 0 }}>
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
                                        {draft.receipts.map((r) => (
                                            <tr key={r.id}>
                                                <td style={{ whiteSpace: "nowrap" }}>{time(r.receivedAt)}</td>
                                                <td>
                                                    {(r.patientName ?? r.patientId.slice(0, 8)).slice(0, 28)}
                                                    {r.kind !== "RECEIPT" ? ` · ${t(`page.day_close.journal_kind.${r.kind.toLowerCase()}`)}` : ""}
                                                </td>
                                                <td>{t(`page.day_close.method.${r.method.toLowerCase()}`)}</td>
                                                <td>{r.receiptNumber ?? "—"}</td>
                                                <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{eur(r.amountCents)}</td>
                                            </tr>
                                        ))}
                                        {draft.movements.map((m) => (
                                            <tr key={m.id}>
                                                <td style={{ whiteSpace: "nowrap" }}>{time(m.occurredAt)}</td>
                                                <td>{`${t(`page.day_close.movement.kind.${m.kind.toLowerCase()}`)}: ${m.reason}`}</td>
                                                <td>{t("page.day_close.method.cash")}</td>
                                                <td>{m.receiptRef ?? "—"}</td>
                                                <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{eur(movementSignedCents(m))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {canWrite && !draft.alreadyClosed && draft.asOfDate === todayLocal() ? (
                        <details className="card card-pad">
                            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>{t("page.day_close.movement.title")}</summary>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 10 }}>
                                <Select
                                    id="dc-mv-kind"
                                    label={t("common.type")}
                                    value={mvKind}
                                    onChange={(e) => setMvKind(e.target.value as Exclude<CashMovementKind, "REVERSAL">)}
                                    options={(["OPENING_FLOAT", "DEPOSIT", "WITHDRAWAL", "BANK_DEPOSIT", "EXPENSE"] as const).map((k) => ({
                                        value: k,
                                        label: t(`page.day_close.movement.kind.${k.toLowerCase()}`),
                                    }))}
                                />
                                <Input id="dc-mv-amount" label={t("common.amount")} value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} />
                                <Input id="dc-mv-reason" label={t("page.day_close.movement.reason")} value={mvReason} onChange={(e) => setMvReason(e.target.value)} />
                                <Input
                                    id="dc-mv-voucher"
                                    label={mvKind === "EXPENSE" ? t("page.day_close.movement.voucher_required") : t("page.day_close.movement.voucher")}
                                    value={mvVoucher}
                                    onChange={(e) => setMvVoucher(e.target.value)}
                                />
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Button type="button" size="sm" variant="secondary" onClick={() => void addMovement()} disabled={busy}>
                                    {t("page.day_close.movement.add")}
                                </Button>
                            </div>
                        </details>
                    ) : null}

                    {!draft.alreadyClosed ? (
                        <>
                            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.day_close.form.count_title")}</p>
                                    <label className="row" style={{ gap: 8, alignItems: "center", fontSize: 13 }}>
                                        <input type="checkbox" checked={byDenomination} onChange={(e) => setByDenomination(e.target.checked)} />
                                        {t("page.day_close.form.by_denomination")}
                                    </label>
                                </div>
                                {byDenomination ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                                        {EURO_DENOMINATIONS.map((d) => (
                                            <Input
                                                key={d}
                                                id={`dc-den-${d}`}
                                                type="number"
                                                min={0}
                                                label={eur(d)}
                                                value={denoms[String(d)] ?? ""}
                                                onChange={(e) => setDenoms((s) => ({ ...s, [String(d)]: e.target.value }))}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Input
                                        id="dc-counted"
                                        label={t("page.day_close.form.counted_label")}
                                        placeholder={t("page.day_close.form.counted_ph")}
                                        value={countedRaw}
                                        onChange={(e) => setCountedRaw(e.target.value)}
                                    />
                                )}
                                {row(t("page.day_close.form.counted_total"), countedCents == null ? "—" : eur(countedCents), true)}
                                {variance != null
                                    ? row(t("page.day_close.form.deviation_label"), eur(variance), variance !== 0)
                                    : null}
                            </div>

                            <Input
                                id="dc-terminal"
                                label={t("page.day_close.form.terminal_label")}
                                placeholder={t("page.day_close.form.terminal_ph")}
                                value={terminalRaw}
                                onChange={(e) => setTerminalRaw(e.target.value)}
                            />
                            {cardVariance != null && cardVariance !== 0 ? (
                                <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                                    {tp("page.day_close.form.card_variance", { amount: eur(cardVariance) })}
                                </p>
                            ) : null}

                            <Textarea
                                id="dc-note"
                                label={needsNote ? t("page.day_close.form.reason_required") : t("page.day_close.form.remark_label")}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={2}
                            />

                            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                {showCancelButton && onCancel ? (
                                    <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                                        {t("common.cancel")}
                                    </Button>
                                ) : null}
                                <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canClose || busy} loading={busy}>
                                    {t("page.day_close.form.close_btn")}
                                </Button>
                            </div>
                        </>
                    ) : null}
                </>
            ) : null}

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => void submit()}
                title={t("page.day_close.form.confirm_title")}
                message={tp("page.day_close.form.confirm_message", {
                    date: draft ? formatDate(draft.asOfDate) : "",
                    counted: countedCents == null ? "—" : eur(countedCents),
                })}
            />
        </div>
    );
}
