import { useT, useTParams } from "@/lib/i18n";
import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Treatment, Examination, Payment, PaymentMethod } from "@/models/types";
import { itemValidationKey, type ValidationRecord } from "@/lib/chart-validation";
import { ShieldCheckIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    paymentMethodSelectOptions,
    PAYMENT_EUR_EPS,
    formatPaymentReferenceLine,
    roundMoney2,
    sumPaymentsForTreatment,
    sumPaymentsForExamination,
    paymentCountsTowardPaid,
    paymentHistoryForTreatment,
    paymentHistoryForExamination,
    paymentStatusDisplay,
    paymentMethodLabel,
    type PaymentAssignmentSummaryRow,
} from "@/lib/payment-booking";
import { ChartEditFormOrInline, ChartInlineEditPanelShell, ConfirmOrInline } from "@/views/components/chart-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { PaymentRowActionsMenu, type PaymentRowAction } from "@/views/components/payment-row-actions-menu";

export type PaymentNewFormState = {
    linkKind: "" | "treatment" | "examination";
    linkId: string;
    amount: string;
    payment_method: PaymentMethod;
    description: string;
};

export type PaymentEditFormState = {
    amount: string;
    payment_method: PaymentMethod;
    description: string;
};

export type PatientDetailPaymentTabProps = {
    patientId: string | undefined;
    hasPaymentData: boolean;
    paymentListenModus: "summe" | "historie";
    onPaymentListenModusChange: (modus: "summe" | "historie") => void;
    canFinanceWrite: boolean;
    canViewClinical: boolean;
    showPaymentComposer: boolean;
    onOpenPaymentComposer: () => void;
    onClosePaymentComposer: () => void;
    treatments: Treatment[];
    examinations: Examination[];
    payments: Payment[];
    paymentNewForm: PaymentNewFormState;
    setPaymentNewForm: Dispatch<SetStateAction<PaymentNewFormState>>;
    paymentLinkSelectOptionsOpen: { value: string; label: string }[];
    paymentNewMaxAmountEur: number | null;
    paymentZuordnungSummaries: PaymentAssignmentSummaryRow[];
    paymentsHistorisch: Payment[];
    paymentEdit: Payment | null;
    paymentEditUnlocked: boolean;
    paymentEditForm: PaymentEditFormState;
    setPaymentEditForm: Dispatch<SetStateAction<PaymentEditFormState>>;
    paymentEditMaxAmountEur: number | null;
    paymentDeleteId: string | null;
    itemValidation: Partial<Record<string, ValidationRecord>>;
    onPrintReceipt: (z: Payment) => void | Promise<void>;
    onPrintReceiptFromSummeRow: (row: PaymentAssignmentSummaryRow) => void;
    onSubmitSavePaymentNew: () => void | Promise<void>;
    onSavePaymentEdit: () => void | Promise<void>;
    onDeletePayment: () => void | Promise<void>;
    onCancelDeletePayment: () => void;
    onClosePaymentEdit: () => void;
    onUnlockPaymentEdit: () => void;
    onStartEditPayment: (z: Payment) => void;
    onRequestDeletePayment: (paymentId: string) => void;
    onRequestValidateItem: (key: string, label: string) => void | Promise<void>;
    onRevokeItemValidation: (key: string, label: string) => void | Promise<void>;
    toast: (message: string, variant: "success" | "error" | "info") => void;
};

export function PatientDetailPaymentTab({
    patientId: id,
    hasPaymentData,
    paymentListenModus,
    onPaymentListenModusChange,
    canFinanceWrite,
    canViewClinical,
    showPaymentComposer,
    onOpenPaymentComposer,
    onClosePaymentComposer,
    treatments,
    examinations,
    payments,
    paymentNewForm,
    setPaymentNewForm,
    paymentLinkSelectOptionsOpen,
    paymentNewMaxAmountEur,
    paymentZuordnungSummaries,
    paymentsHistorisch,
    paymentEdit,
    paymentEditUnlocked,
    paymentEditForm,
    setPaymentEditForm,
    paymentEditMaxAmountEur,
    paymentDeleteId,
    itemValidation,
    onPrintReceipt: handlePrintReceipt,
    onPrintReceiptFromSummeRow: handlePrintReceiptFromSummeRow,
    onSubmitSavePaymentNew: submitSavePaymentNew,
    onSavePaymentEdit,
    onDeletePayment,
    onCancelDeletePayment,
    onClosePaymentEdit,
    onUnlockPaymentEdit,
    onStartEditPayment,
    onRequestDeletePayment,
    onRequestValidateItem: requestValidateItem,
    onRevokeItemValidation: revokeItemValidationRow,
    toast,
}: PatientDetailPaymentTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const requireReleasedHint = tp("patient.detail.tab.payment.release_required", {
        entity: t("patient.detail.tab.payment.entity.treatment"),
    });

    const renderPaymentPaymentEditFields = (): ReactNode => {
        if (!paymentEdit || !canFinanceWrite) return null;
        const z = paymentEdit;
        const pid = id ?? "";
        let reference = emDash;
        if (z.treatment_id) {
            const b = treatments.find((x) => x.id === z.treatment_id);
            const bn = (b?.treatment_number ?? "").trim();
            reference = bn
                ? tp("patient.detail.tab.payment.treatment_ref", { number: bn })
                : t("patient.detail.tab.payment.treatment_ref_short");
        } else if (z.examination_id) {
            const u = examinations.find((x) => x.id === z.examination_id);
            const un = (u?.examination_number ?? "").trim();
            reference = un
                ? tp("patient.detail.tab.payment.examination_ref", { number: un })
                : t("patient.detail.tab.payment.examination_ref_short");
        }
        const bRow = z.treatment_id ? treatments.find((x) => x.id === z.treatment_id) : undefined;
        const gesamtLive =
            bRow?.total_cost != null && Number.isFinite(bRow.total_cost)
                ? bRow.total_cost
                : z.amount_expected != null && Number.isFinite(z.amount_expected)
                    ? z.amount_expected
                    : null;
        let histBlock: ReactNode = null;
        let openAfter: number | null = null;
        if (z.treatment_id && pid) {
            const hist = paymentHistoryForTreatment(payments, pid, z.treatment_id);
            const otherPaid = payments
                .filter(
                    (x) =>
                        x.patient_id === pid
                        && x.treatment_id === z.treatment_id
                        && x.id !== z.id
                        && paymentCountsTowardPaid(x.status),
                )
                .reduce((s, x) => s + x.amount, 0);
            const cur = Number(String(paymentEditForm.amount).replace(",", "."));
            const curOk = Number.isFinite(cur) && cur > 0 ? cur : 0;
            const totalPaid = otherPaid + curOk;
            openAfter = gesamtLive != null && gesamtLive > 0 ? Math.max(0, gesamtLive - totalPaid) : null;
            histBlock = (
                <div style={{ marginTop: 12 }}>
                    <div
                        style={{
                            fontSize: 11,
                            letterSpacing: "0.04em",
                            color: "var(--fg-3)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                        }}
                    >
                        {t("patient.detail.tab.payment.history_same_line")}
                    </div>
                    {hist.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                            {hist.map((h) => {
                                const hs = paymentStatusDisplay(h.status, t);
                                return (
                                    <li key={h.id} style={{ opacity: h.id === z.id ? 1 : 0.85 }}>
                                        {formatDate(h.created_at)}
                                        {" · "}
                                        {h.amount.toFixed(2)} €
                                        {" · "}
                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                        {h.id === z.id ? t("patient.detail.tab.payment.this_booking") : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            );
        } else if (z.examination_id && pid) {
            const histU = paymentHistoryForExamination(payments, pid, z.examination_id);
            histBlock = (
                <div style={{ marginTop: 12 }}>
                    <div
                        style={{
                            fontSize: 11,
                            letterSpacing: "0.04em",
                            color: "var(--fg-3)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                        }}
                    >
                        {t("patient.detail.tab.payment.history_title")}
                    </div>
                    {histU.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                            {histU.map((h) => {
                                const hs = paymentStatusDisplay(h.status, t);
                                return (
                                    <li key={h.id}>
                                        {formatDate(h.created_at)}
                                        {" · "}
                                        {h.amount.toFixed(2)} €
                                        {" · "}
                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                        {h.id === z.id ? t("patient.detail.tab.payment.this_booking") : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            );
        }
        return (
            <>
                <div
                    className="rounded-lg px-4 py-3"
                    style={{ border: "1px solid var(--line)", background: "var(--surface)", marginBottom: 12 }}
                >
                    <div style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--fg-3)", textTransform: "uppercase" }}>
                        {t("patient.detail.tab.payment.assignment")}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{reference}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginTop: 12, fontSize: 14 }}>
                        <div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.cost_should")}</div>
                            <div style={{ fontWeight: 700 }}>
                                {gesamtLive != null ? formatCurrency(gesamtLive) : emDash}
                            </div>
                        </div>
                        {z.treatment_id && openAfter != null ? (
                            <div>
                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.open_after_edit")}</div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                            </div>
                        ) : null}
                    </div>
                    {histBlock}
                </div>
                <div>
                    <Input
                        id="zex-amount"
                        type="number"
                        step="0.01"
                        min={0}
                        max={paymentEditMaxAmountEur != null ? paymentEditMaxAmountEur : undefined}
                        label={t("patient.detail.tab.payment.amount_label")}
                        value={paymentEditForm.amount}
                        disabled={!paymentEditUnlocked}
                        onChange={(e) => setPaymentEditForm({ ...paymentEditForm, amount: e.target.value })}
                        onBlur={(e) => {
                            if (paymentEditMaxAmountEur == null) return;
                            const n = Number(String(e.target.value).replace(",", "."));
                            if (!Number.isFinite(n) || n <= 0) return;
                            if (n > paymentEditMaxAmountEur + PAYMENT_EUR_EPS) {
                                setPaymentEditForm((p) => ({
                                    ...p,
                                    amount: String(roundMoney2(paymentEditMaxAmountEur)),
                                }));
                                toast(
                                    tp("patient.detail.tab.payment.amount_capped_edit", {
                                        amount: formatCurrency(paymentEditMaxAmountEur),
                                    }),
                                    "info",
                                );
                            }
                        }}
                    />
                    {paymentEditMaxAmountEur != null ? (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                            {tp("patient.detail.tab.payment.max_hint_edit", { amount: formatCurrency(paymentEditMaxAmountEur) })}
                        </p>
                    ) : null}
                </div>
                <Select
                    id="zex-kind"
                    label={t("patient.detail.tab.payment.payment_method")}
                    value={paymentEditForm.payment_method}
                    disabled={!paymentEditUnlocked}
                    onChange={(e) => setPaymentEditForm({ ...paymentEditForm, payment_method: e.target.value as PaymentMethod })}
                    options={paymentMethodSelectOptions(t)}
                />
                <Textarea
                    id="zex-beschr"
                    label={t("common.description")}
                    rows={2}
                    value={paymentEditForm.description}
                    disabled={!paymentEditUnlocked}
                    onChange={(e) => setPaymentEditForm({ ...paymentEditForm, description: e.target.value })}
                />
            </>
        );
    };

    const paymentEditPanelSubtitle = paymentEditUnlocked
        ? t("patient.detail.tab.payment.edit_subtitle_unlocked")
        : t("patient.detail.tab.payment.edit_subtitle_locked");

    const paymentEditPanelHeaderExtra =
        paymentEdit && !paymentEditUnlocked ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onUnlockPaymentEdit()}>
                {t("common.edit")}
            </Button>
        ) : null;

    const paymentEditPanelFooter =
        paymentEdit && canFinanceWrite ? (
            <>
                <Button type="button" variant="ghost" onClick={onClosePaymentEdit}>
                    {t("common.cancel")}
                </Button>
                <Button
                    type="button"
                    disabled={
                        !paymentEditUnlocked
                        || paymentEditMaxAmountEur != null && paymentEditMaxAmountEur <= PAYMENT_EUR_EPS
                    }
                    onClick={() => void onSavePaymentEdit()}
                >
                    {t("common.save")}
                </Button>
            </>
        ) : null;

    return (
        <div id="panel-payment" role="tabpanel" aria-labelledby="tab-payment">
            <Card className="card-pad card--overflow-visible">
                <CardHeader
                    title={t("patient.detail.tab.payment.title")}
                    subtitle={
                        !hasPaymentData
                            ? t("patient.detail.tab.payment.subtitle_empty")
                            : paymentListenModus === "summe"
                                ? t("patient.detail.tab.payment.subtitle_summe")
                                : t("patient.detail.tab.payment.subtitle_historie")
                    }
                    action={(
                        <div className="chart-payment-toolbar">
                            <div className="chart-payment-modus" role="tablist" aria-label={t("patient.detail.tab.payment.view_billing_aria")}>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={paymentListenModus === "summe"}
                                    className={`chart-payment-modus__btn${paymentListenModus === "summe" ? " is-active" : ""}`}
                                    onClick={() => onPaymentListenModusChange("summe")}
                                >
                                    {t("patient.detail.tab.payment.tab_payments")}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={paymentListenModus === "historie"}
                                    className={`chart-payment-modus__btn${paymentListenModus === "historie" ? " is-active" : ""}`}
                                    onClick={() => onPaymentListenModusChange("historie")}
                                >
                                    {t("patient.detail.tab.payment.tab_historie")}
                                </button>
                            </div>
                            {canFinanceWrite ? (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="chart-payment-toolbar__cta"
                                    disabled={showPaymentComposer}
                                    onClick={onOpenPaymentComposer}
                                >
                                    {t("patient.detail.tab.payment.new_cta")}
                                </Button>
                            ) : null}
                        </div>
                    )}
                />
                {canFinanceWrite && showPaymentComposer ? (
                    <div
                        id="ak-payment-new-panel"
                        className="chart-inline-panel"
                        style={{ marginBottom: 20 }}
                        role="region"
                        aria-label={t("patient.detail.tab.payment.new_aria")}
                    >
                        <div className="chart-inline-panel-head">
                            <div>
                                <div className="chart-inline-panel-title">{t("patient.detail.tab.payment.new_title")}</div>
                                <div className="chart-inline-panel-sub">
                                    {tp("patient.detail.tab.payment.new_subtitle", { hint: requireReleasedHint })}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    onClosePaymentComposer();
                                }}
                            >
                                {t("common.close")}
                            </Button>
                        </div>
                        <div className="chart-inline-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {treatments.length + examinations.length === 0 ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("patient.detail.tab.payment.new_no_clinical")}
                                </p>
                            ) : paymentLinkSelectOptionsOpen.length <= 1 ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("patient.detail.tab.payment.new_no_open")}
                                </p>
                            ) : null}
                            <Select
                                id="payment-new-link"
                                label={t("patient.detail.tab.payment.assignment_label")}
                                value={
                                    paymentNewForm.linkKind && paymentNewForm.linkId
                                        ? `${paymentNewForm.linkKind}:${paymentNewForm.linkId}`
                                        : ""
                                }
                                options={paymentLinkSelectOptionsOpen}
                                disabled={paymentLinkSelectOptionsOpen.length <= 1}
                                onChange={(e) => {
                                    const version = e.target.value;
                                    if (!version) {
                                        setPaymentNewForm((p) => ({ ...p, linkKind: "", linkId: "" }));
                                        return;
                                    }
                                    const ci = version.indexOf(":");
                                    const kind = version.slice(0, ci) as "treatment" | "examination";
                                    const rest = version.slice(ci + 1);
                                    setPaymentNewForm((p) => ({ ...p, linkKind: kind, linkId: rest }));
                                }}
                            />
                            {paymentNewForm.linkKind && paymentNewForm.linkId && id ? (
                                (() => {
                                    const pid = id;
                                    if (paymentNewForm.linkKind === "treatment") {
                                        const selBh = treatments.find((b) => b.id === paymentNewForm.linkId);
                                        const gesamt =
                                            selBh?.total_cost != null && Number.isFinite(selBh.total_cost)
                                                ? selBh.total_cost
                                                : null;
                                        const hist = paymentHistoryForTreatment(payments, pid, paymentNewForm.linkId);
                                        const paidSum = sumPaymentsForTreatment(payments, pid, paymentNewForm.linkId);
                                        const openNow =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum) : null;
                                        const amountN = Number(String(paymentNewForm.amount).replace(",", "."));
                                        const add = Number.isFinite(amountN) && amountN > 0 ? amountN : 0;
                                        const openAfter =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum - add) : null;
                                        const previewCase =
                                            gesamt != null && gesamt > 0 && openAfter != null
                                                ? openAfter <= 1e-6
                                                    ? "PAID"
                                                    : "PARTIALLY_PAID"
                                                : "PAID";
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            letterSpacing: "0.04em",
                                                            color: "var(--fg-3)",
                                                            textTransform: "uppercase",
                                                            marginBottom: 10,
                                                        }}
                                                    >
                                                        {t("patient.detail.tab.payment.cost_section_treatment")}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.cost_should")}</div>
                                                            <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : emDash}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.paid_already")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.cost_open_now")}</div>
                                                            <div style={{ fontWeight: 700, color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)" }}>
                                                                {openNow != null ? formatCurrency(openNow) : emDash}
                                                            </div>
                                                        </div>
                                                        {add > 0 && openAfter != null ? (
                                                            <div>
                                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.cost_open_after_payment")}</div>
                                                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            letterSpacing: "0.04em",
                                                            color: "var(--fg-3)",
                                                            textTransform: "uppercase",
                                                            marginBottom: 6,
                                                        }}
                                                    >
                                                        {t("patient.detail.tab.payment.history_for_line")}
                                                    </div>
                                                    {hist.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {hist.map((h) => {
                                                                const hs = paymentStatusDisplay(h.status, t);
                                                                return (
                                                                    <li key={h.id}>
                                                                        {formatDate(h.created_at)}
                                                                        {" · "}
                                                                        {h.amount.toFixed(2)} €
                                                                        {" · "}
                                                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            {t("patient.detail.tab.payment.history_empty_treatment")}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                                    <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.case_after_save")}</span>
                                                    <Badge variant={previewCase === "PAID" ? "success" : previewCase === "PARTIALLY_PAID" ? "warning" : "default"}>
                                                        {previewCase === "PAID"
                                                            ? t("patient.detail.tab.payment.case_balanced")
                                                            : previewCase === "PARTIALLY_PAID"
                                                                ? t("patient.detail.tab.payment.case_still_open")
                                                                : previewCase}
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    }
                                    const histU = paymentHistoryForExamination(payments, pid, paymentNewForm.linkId);
                                    const paidU = sumPaymentsForExamination(payments, pid, paymentNewForm.linkId);
                                    return (
                                        <>
                                            <div
                                                className="rounded-lg px-4 py-3"
                                                style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        letterSpacing: "0.04em",
                                                        color: "var(--fg-3)",
                                                        textTransform: "uppercase",
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    {t("patient.detail.tab.payment.examination_no_target")}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.cost_should")}</div>
                                                        <div style={{ fontWeight: 600 }}>{emDash}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.payment.paid_sum")}</div>
                                                        <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                                    </div>
                                                </div>
                                                <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                                    {t("patient.detail.tab.payment.examination_target_hint")}
                                                </p>
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        letterSpacing: "0.04em",
                                                        color: "var(--fg-3)",
                                                        textTransform: "uppercase",
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    {t("patient.detail.tab.payment.history_title")}
                                                </div>
                                                {histU.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                        {histU.map((h) => {
                                                            const hs = paymentStatusDisplay(h.status, t);
                                                            return (
                                                                <li key={h.id}>
                                                                    {formatDate(h.created_at)}
                                                                    {" · "}
                                                                    {h.amount.toFixed(2)} €
                                                                    {" · "}
                                                                    {hs.label}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                        {t("patient.detail.tab.payment.history_empty_unter")}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()
                            ) : null}
                            <div>
                                <Input
                                    id="payment-new-amount"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={paymentNewMaxAmountEur != null ? paymentNewMaxAmountEur : undefined}
                                    label={t("patient.detail.tab.payment.payment_amount_label")}
                                    value={paymentNewForm.amount}
                                    onChange={(e) => setPaymentNewForm({ ...paymentNewForm, amount: e.target.value })}
                                    onBlur={(e) => {
                                        if (paymentNewMaxAmountEur == null) return;
                                        const n = Number(String(e.target.value).replace(",", "."));
                                        if (!Number.isFinite(n) || n <= 0) return;
                                        if (n > paymentNewMaxAmountEur + PAYMENT_EUR_EPS) {
                                            setPaymentNewForm((p) => ({
                                                ...p,
                                                amount: String(roundMoney2(paymentNewMaxAmountEur)),
                                            }));
                                            toast(
                                                tp("patient.detail.tab.payment.amount_capped_new", {
                                                    amount: formatCurrency(paymentNewMaxAmountEur),
                                                }),
                                                "info",
                                            );
                                        }
                                    }}
                                />
                                {paymentNewMaxAmountEur != null ? (
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                        {tp("patient.detail.tab.payment.max_hint_new", { amount: formatCurrency(paymentNewMaxAmountEur) })}
                                    </p>
                                ) : null}
                            </div>
                            <Select
                                id="payment-new-kind"
                                label={t("patient.detail.tab.payment.payment_method")}
                                value={paymentNewForm.payment_method}
                                onChange={(e) =>
                                    setPaymentNewForm({ ...paymentNewForm, payment_method: e.target.value as PaymentMethod })}
                                options={paymentMethodSelectOptions(t)}
                            />
                            <Textarea
                                id="payment-new-beschr"
                                label={t("common.description")}
                                rows={2}
                                value={paymentNewForm.description}
                                onChange={(e) => setPaymentNewForm({ ...paymentNewForm, description: e.target.value })}
                            />
                        </div>
                        <div className="chart-inline-panel-actions" style={{ flexWrap: "wrap", gap: 10 }}>
                            {paymentNewForm.linkKind === "treatment"
                            && paymentNewMaxAmountEur != null
                            && paymentNewMaxAmountEur <= PAYMENT_EUR_EPS ? (
                                <span style={{ fontSize: 12, color: "var(--fg-3)", flex: "1 1 200px" }}>
                                    {t("patient.detail.tab.payment.no_further_open")}
                                </span>
                            ) : null}
                            <Button type="button" variant="ghost" onClick={() => onClosePaymentComposer()}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    paymentNewForm.linkKind === "treatment"
                                    && paymentNewMaxAmountEur != null
                                    && paymentNewMaxAmountEur <= PAYMENT_EUR_EPS
                                }
                                onClick={() => void submitSavePaymentNew()}
                            >
                                {t("patient.detail.tab.payment.save_payment")}
                            </Button>
                        </div>
                    </div>
                ) : null}
                {payments.length === 0 ? (
                    <p style={{ color: "var(--fg-3)" }}>{t("patient.detail.payment.empty")}</p>
                ) : paymentListenModus === "summe" ? (
                    paymentZuordnungSummaries.length === 0 ? (
                        <p style={{ color: "var(--fg-3)" }}>
                            {t("patient.detail.tab.payment.no_summaries")}
                        </p>
                    ) : (
                        <table className="tbl tbl-payment-chart">
                            <colgroup>
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "20%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "14%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="col">{t("patient.detail.tab.payment.col.last_booking")}</th>
                                    <th scope="col">{t("patient.detail.tab.payment.col.assignment")}</th>
                                    <th scope="col" className="payment-th-num">{t("patient.detail.tab.payment.col.should")}</th>
                                    <th scope="col" className="payment-th-num">{t("patient.detail.tab.payment.col.paid")}</th>
                                    <th scope="col" className="payment-th-num">{t("patient.detail.tab.payment.col.open")}</th>
                                    <th scope="col">{t("patient.detail.tab.payment.col.status")}</th>
                                    <th scope="col">{t("patient.detail.tab.payment.col.action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentZuordnungSummaries.map((row) => {
                                    const st = paymentStatusDisplay(row.status, t);
                                    return (
                                        <tr key={row.key}>
                                            <td>
                                                <div className="payment-td-clip" title={formatDate(row.latestAt)}>
                                                    {formatDate(row.latestAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="payment-td-clip" title={row.referenceLine}>
                                                    {row.referenceLine}
                                                </div>
                                            </td>
                                            <td className="payment-td-num">{row.soll != null ? formatCurrency(row.soll) : emDash}</td>
                                            <td className="payment-td-num">{formatCurrency(row.gezahlt)}</td>
                                            <td className="payment-td-num">
                                                {row.offen != null ? formatCurrency(row.offen) : emDash}
                                            </td>
                                            <td>
                                                <Badge variant={st.variant}>{st.label}</Badge>
                                            </td>
                                            <td className="payment-td-actions">
                                                <PaymentRowActionsMenu
                                                    ariaLabel={t("common.actions")}
                                                    actions={[
                                                        {
                                                            id: "receipt",
                                                            label: t("patient.detail.tab.payment.receipt"),
                                                            onClick: () => handlePrintReceiptFromSummeRow(row),
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                ) : (
                    <table className="tbl tbl-payment-chart">
                        <colgroup>
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "8%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">{t("patient.detail.tab.payment.col.date")}</th>
                                <th scope="col">{t("patient.detail.tab.payment.col.reference")}</th>
                                <th scope="col">{t("patient.detail.tab.payment.col.type")}</th>
                                <th scope="col">{t("patient.detail.tab.payment.col.status")}</th>
                                <th scope="col" className="payment-th-num">{t("patient.detail.tab.payment.col.amount")}</th>
                                <th scope="col">{t("patient.detail.tab.payment.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentsHistorisch.flatMap((z) => {
                                const st = paymentStatusDisplay(z.status, t);
                                const referenceLine = formatPaymentReferenceLine(z, treatments, examinations, t, tp);
                                let reference = emDash;
                                if (z.treatment_id) {
                                    const b = treatments.find((x) => x.id === z.treatment_id);
                                    const bn = (b?.treatment_number ?? "").trim();
                                    reference = bn
                                        ? tp("patient.detail.tab.payment.treatment_short", { number: bn })
                                        : t("patient.detail.tab.payment.treatment_ref_short");
                                } else if (z.examination_id) {
                                    const u = examinations.find((x) => x.id === z.examination_id);
                                    const un = (u?.examination_number ?? "").trim();
                                    reference = un
                                        ? tp("patient.detail.tab.payment.examination_short", { number: un })
                                        : t("patient.detail.tab.payment.examination_ref_short");
                                }
                                const dataRow = (
                                    <tr key={z.id}>
                                        <td>
                                            <div className="payment-td-clip" title={formatDate(z.created_at)}>
                                                {formatDate(z.created_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="payment-td-clip" title={referenceLine}>
                                                {reference}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="payment-td-clip" title={paymentMethodLabel(z.payment_method, t)}>
                                                {paymentMethodLabel(z.payment_method, t)}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={st.variant}>{st.label}</Badge>
                                        </td>
                                        <td className="payment-td-num">{z.amount.toFixed(2)} €</td>
                                        <td className="payment-td-actions">
                                            {(() => {
                                                const canEditPayment =
                                                    canFinanceWrite &&
                                                    (z.status === "OUTSTANDING" || z.status === "PARTIALLY_PAID");
                                                const validated = Boolean(
                                                    itemValidation[itemValidationKey("payment", z.id)],
                                                );
                                                const actions: PaymentRowAction[] = [
                                                    {
                                                        id: "receipt",
                                                        label: t("patient.detail.tab.payment.receipt"),
                                                        onClick: () => handlePrintReceipt(z),
                                                    },
                                                ];
                                                if (canViewClinical) {
                                                    actions.push(
                                                        validated
                                                            ? {
                                                                  id: "revoke",
                                                                  label: t("patient.detail.tab.payment.revoke_validation"),
                                                                  onClick: () =>
                                                                      void revokeItemValidationRow(
                                                                          itemValidationKey("payment", z.id),
                                                                          tp("patient.detail.tab.payment.validate_label_amount", {
                                                                              amount: z.amount.toFixed(2),
                                                                          }),
                                                                      ),
                                                              }
                                                            : {
                                                                  id: "validate",
                                                                  label: (
                                                                      <>
                                                                          <ShieldCheckIcon size={14} />
                                                                          {t("patient.detail.tab.payment.validate")}
                                                                      </>
                                                                  ),
                                                                  onClick: () =>
                                                                      void requestValidateItem(
                                                                          itemValidationKey("payment", z.id),
                                                                          tp("patient.detail.tab.payment.validate_label_dated", {
                                                                              date: formatDate(z.created_at),
                                                                              amount: z.amount.toFixed(2),
                                                                          }),
                                                                      ),
                                                              },
                                                    );
                                                }
                                                if (canFinanceWrite) {
                                                    actions.push(
                                                        {
                                                            id: "edit",
                                                            label: t("common.edit"),
                                                            onClick: () => onStartEditPayment(z),
                                                            disabled: !canEditPayment,
                                                        },
                                                        {
                                                            id: "delete",
                                                            label: t("common.delete"),
                                                            onClick: () => onRequestDeletePayment(z.id),
                                                            disabled: !canEditPayment,
                                                            danger: true,
                                                        },
                                                    );
                                                }
                                                return (
                                                    <PaymentRowActionsMenu
                                                        ariaLabel={tp("patient.detail.tab.payment.row_actions_aria", {
                                                            amount: z.amount.toFixed(2),
                                                        })}
                                                        actions={actions}
                                                    />
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                );
                                if (canFinanceWrite && paymentListenModus === "historie" && paymentEdit?.id === z.id) {
                                    return [
                                        <tr key={`${z.id}__edit`} className="payment-historie-edit-row">
                                            <td colSpan={6} className="payment-historie-edit-cell">
                                                <ChartInlineEditPanelShell
                                                    id="ak-payment-edit-panel-row"
                                                    ariaLabel={t("patient.detail.tab.payment.edit_aria")}
                                                    title={t("patient.detail.tab.payment.edit_title")}
                                                    subtitle={paymentEditPanelSubtitle}
                                                    headerExtra={paymentEditPanelHeaderExtra}
                                                    onClose={onClosePaymentEdit}
                                                    footer={paymentEditPanelFooter}
                                                    rootClassName="chart-inline-panel--payment-table-edit"
                                                >
                                                    {renderPaymentPaymentEditFields()}
                                                </ChartInlineEditPanelShell>
                                            </td>
                                        </tr>,
                                        dataRow,
                                    ];
                                }
                                return [dataRow];
                            })}
                        </tbody>
                    </table>
                )}
                {canFinanceWrite && paymentDeleteId ? (
                    <ConfirmOrInline
                        area="patient_chart_payment_delete"
                        open={canFinanceWrite && !!paymentDeleteId}
                        inlineId="ak-payment-delete-panel"
                        title={t("patient.detail.payment.delete_title")}
                        message={(() => {
                            const z = payments.find((x) => x.id === paymentDeleteId);
                            return z
                                ? tp("patient.detail.tab.payment.delete_message", {
                                      amount: z.amount.toFixed(2),
                                      method: z.payment_method,
                                      status: z.status,
                                  })
                                : t("patient.detail.tab.payment.delete_message_generic");
                        })()}
                        onCancel={onCancelDeletePayment}
                        onConfirm={() => void onDeletePayment()}
                        confirmLabel={t("common.yes_delete")}
                        danger
                    />
                ) : null}
                {canFinanceWrite && paymentEdit && paymentListenModus !== "historie" ? (
                    <ChartEditFormOrInline
                        area="patient_chart_payment_edit"
                        open={canFinanceWrite && !!paymentEdit}
                        onClose={onClosePaymentEdit}
                        title={t("patient.detail.tab.payment.edit_title")}
                        subtitle={paymentEditPanelSubtitle}
                        inlineId="ak-payment-edit-panel"
                        ariaLabel={t("patient.detail.tab.payment.edit_aria")}
                        headerExtra={paymentEditPanelHeaderExtra}
                        footer={paymentEditPanelFooter}
                    >
                        {renderPaymentPaymentEditFields()}
                    </ChartEditFormOrInline>
                ) : null}
            </Card>
        </div>
    );
}
