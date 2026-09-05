import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPayment, listPaymentsForPatient } from "@/systems/practice-host/controllers/payment.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import type { Treatment, Patient, Examination, Payment, PaymentMethod } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { PatientComboField } from "../components/patient-combo-field";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { Badge } from "../components/ui/badge";
import {
    paymentMethodSelectOptions,
    PAYMENT_EUR_EPS,
    buildOpenPaymentLinkSelectOptions,
    formatPaymentReferenceLine,
    maxNewPaymentTreatment,
    maxNewPaymentExamination,
    parsePaymentLinkValue,
    roundMoney2,
    sumPaymentsForTreatment,
    sumPaymentsForExamination,
    paymentHistoryForTreatment,
    paymentHistoryForExamination,
    paymentStatusDisplay,
    paymentMethodLabel,
} from "@/lib/payment-booking";

type LinkKind = "" | "treatment" | "examination";

function PaymentFinanceOrPageWrap({
    isFinance,
    embedVariant,
    onClose,
    children,
}: {
    isFinance: boolean;
    embedVariant?: "finance" | "cash";
    onClose: () => void;
    children: ReactNode;
}) {
    const t = useT();
    if (!isFinance) {
        return (
            <Card className="payment-create-page__card card-elevated">
                <CardHeader
                    title={t("payment.create.payment_data")}
                    subtitle={t("payment.create.subtitle")}
                />
                <div className="card-pad">{children}</div>
            </Card>
        );
    }
    const subtitle =
        embedVariant === "cash"
            ? t("payment.create.embed_cash_sub")
            : t("payment.create.embed_finance_sub");
    return (
        <Card className="products-detail-card payment-finance-embed card--overflow-visible">
            <CardHeader
                title={t("payment.create.title")}
                subtitle={subtitle}
                action={(
                    <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                )}
            />
            <div className="card-pad payment-finance-embed__body">{children}</div>
        </Card>
    );
}

export type PaymentCreatePanelProps = {
    /** `page` = Finance route; `cash-page` = cash receipts route; `finance` / `cash` = embedded. */
    variant?: "page" | "cash-page" | "finance" | "cash";
    onFinanceSaved?: () => void;
    onFinanceClose?: () => void;
};

function PaymentCreatePanelInner({ variant, onFinanceSaved, onFinanceClose }: PaymentCreatePanelProps) {
    const t = useT();
    const tp = useTParams();
    const isFinanceEmbed = variant === "finance" || variant === "cash";
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canListLines = role != null && allowed("patient.treatments_list_for_payment", role);

    const initialPatient = isFinanceEmbed ? "" : (searchParams.get("patient_id") ?? "");

    const [patients, setPatients] = useState<Patient[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [examinations, setExaminations] = useState<Examination[]>([]);
    const [paymentsPatient, setPaymentsPatient] = useState<Payment[]>([]);
    const [chartLoading, setChartLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [patientId, setPatientId] = useState(initialPatient);
    const [linkKind, setLinkKind] = useState<LinkKind>("");
    const [linkId, setLinkId] = useState("");
    const [amount, setAmount] = useState("");
    const [payment_method, setPaymentMethod] = useState<PaymentMethod>("CASH");
    const [description, setDescription] = useState("");

    const fromParam = searchParams.get("from");
    const fromCash = variant === "cash" || variant === "cash-page" || fromParam === "cash";
    const fromFinance = isFinanceEmbed || (fromParam !== "patient" && !fromCash);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setListLoading(true);
            setLoadError(null);
            try {
                setPatients(await listPatients());
            } catch (e) {
                if (!cancelled) setLoadError(errorMessage(e));
            } finally {
                if (!cancelled) setListLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    /** Monotonic id so stale chart/payment responses cannot overwrite state after patient switch. */
    const chartFetchSeq = useRef(0);

    useEffect(() => {
        if (!patientId || !canListLines) {
            setTreatments([]);
            setExaminations([]);
            setPaymentsPatient([]);
            setLinkKind("");
            setLinkId("");
            setChartLoading(false);
            return;
        }
        const reqId = ++chartFetchSeq.current;
        setChartLoading(true);
        setFormError(null);
        void (async () => {
            try {
                const a = await getChart(patientId);
                const [bh, u, zPat] = await Promise.all([
                    listTreatments(a.id),
                    listExaminations(a.id),
                    listPaymentsForPatient(patientId),
                ]);
                if (chartFetchSeq.current !== reqId) return;
                setTreatments(bh);
                setExaminations(u);
                setPaymentsPatient(zPat);
            } catch (e) {
                if (chartFetchSeq.current !== reqId) return;
                setFormError(errorMessage(e));
                setTreatments([]);
                setExaminations([]);
                setPaymentsPatient([]);
            } finally {
                if (chartFetchSeq.current === reqId) setChartLoading(false);
            }
        })();
    }, [patientId, canListLines]);

    const paymentsPatientSorted = useMemo(
        () => [...paymentsPatient].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [paymentsPatient],
    );

    const paymentLinkOptions = useMemo(() => {
        if (!patientId) return [{ value: "", label: t("common.em_dash") }];
        return buildOpenPaymentLinkSelectOptions(paymentsPatient, patientId, treatments, examinations, t, tp);
    }, [patientId, paymentsPatient, treatments, examinations, t, tp]);

    useEffect(() => {
        if (!patientId || !linkKind || !linkId) return;
        const version = `${linkKind}:${linkId}`;
        if (!paymentLinkOptions.some((o) => o.value === version)) {
            setLinkKind("");
            setLinkId("");
        }
    }, [patientId, linkKind, linkId, paymentLinkOptions]);

    // When exactly one open clinical line exists, assign it automatically and fill amount.
    useEffect(() => {
        if (!patientId || linkKind) return;
        const open = paymentLinkOptions.map((o) => o.value).filter(Boolean);
        if (open.length !== 1) return;
        const parsed = parsePaymentLinkValue(open[0]!);
        if (!parsed) return;
        setLinkKind(parsed.kind);
        setLinkId(parsed.id);
        if (parsed.kind === "treatment") {
            const selBh = treatments.find((b) => b.id === parsed.id);
            const gesamt =
                selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
            const max = maxNewPaymentTreatment(paymentsPatient, patientId, parsed.id, gesamt);
            if (max != null && max > 0) setAmount(String(max));
        } else {
            const selU = examinations.find((u) => u.id === parsed.id);
            const gesamt =
                selU?.total_cost != null && Number.isFinite(selU.total_cost) ? selU.total_cost : null;
            const max = maxNewPaymentExamination(paymentsPatient, patientId, parsed.id, gesamt);
            if (max != null && max > 0) setAmount(String(max));
        }
    }, [
        patientId,
        linkKind,
        paymentLinkOptions,
        treatments,
        examinations,
        paymentsPatient,
    ]);

    const paymentLinkValue = linkKind && linkId ? `${linkKind}:${linkId}` : "";

    const paymentNewMaxAmountEur = useMemo(() => {
        if (!patientId || !linkId) return null;
        if (linkKind === "treatment") {
            const selBh = treatments.find((b) => b.id === linkId);
            const gesamt =
                selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
            return maxNewPaymentTreatment(paymentsPatient, patientId, linkId, gesamt);
        }
        if (linkKind === "examination") {
            const selU = examinations.find((u) => u.id === linkId);
            const gesamt =
                selU?.total_cost != null && Number.isFinite(selU.total_cost) ? selU.total_cost : null;
            return maxNewPaymentExamination(paymentsPatient, patientId, linkId, gesamt);
        }
        return null;
    }, [patientId, linkKind, linkId, treatments, examinations, paymentsPatient]);

    function onPatientChange(id: string) {
        setPatientId(id);
        setLinkKind("");
        setLinkId("");
        setAmount("");
        if (!isFinanceEmbed) {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (id) next.set("patient_id", id);
                else next.delete("patient_id");
                return next;
            }, { replace: true });
        }
    }

    function onPaymentLinkChange(raw: string) {
        if (!raw) {
            setLinkKind("");
            setLinkId("");
            setAmount("");
            return;
        }
        const parsed = parsePaymentLinkValue(raw);
        if (!parsed) {
            setLinkKind("");
            setLinkId("");
            return;
        }
        setLinkKind(parsed.kind);
        setLinkId(parsed.id);
        if (!String(amount).trim() && patientId) {
            if (parsed.kind === "treatment") {
                const selBh = treatments.find((b) => b.id === parsed.id);
                const gesamt =
                    selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
                const open = maxNewPaymentTreatment(paymentsPatient, patientId, parsed.id, gesamt);
                if (open != null && open > 0) setAmount(String(open));
            } else {
                const selU = examinations.find((u) => u.id === parsed.id);
                const gesamt =
                    selU?.total_cost != null && Number.isFinite(selU.total_cost) ? selU.total_cost : null;
                const open = maxNewPaymentExamination(paymentsPatient, patientId, parsed.id, gesamt);
                if (open != null && open > 0) setAmount(String(open));
            }
        }
    }

    const submit = async () => {
        if (!canListLines) {
            setFormError(t("payment.create.error.no_permission"));
            return;
        }
        if (!patientId) {
            setFormError(t("payment.create.error.patient_required"));
            return;
        }
        if (!linkKind || !linkId.trim()) {
            setFormError(t("payment.create.error.link_required"));
            return;
        }
        const amountN = Number(String(amount).replace(",", "."));
        if (!Number.isFinite(amountN) || amountN <= 0) {
            setFormError(t("payment.create.error.amount_invalid"));
            return;
        }
        const selBh = linkKind === "treatment" ? treatments.find((b) => b.id === linkId) : undefined;
        const gesamt =
            selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
        const paidSoFar = linkKind === "treatment" && linkId
            ? sumPaymentsForTreatment(paymentsPatient, patientId, linkId)
            : 0;
        let openBefore: number | undefined;
        if (linkKind === "treatment" && linkId && gesamt != null && Number.isFinite(gesamt)) {
            openBefore = Math.max(0, roundMoney2(gesamt - paidSoFar));
        } else {
            openBefore = undefined;
        }
        if (linkKind === "treatment" && openBefore != null && amountN > openBefore + PAYMENT_EUR_EPS) {
            setFormError(
                tp("payment.create.error.amount_exceeds", { amount: formatCurrency(openBefore) }),
            );
            return;
        }

        setBusy(true);
        setFormError(null);
        try {
            await createPayment({
                patient_id: patientId,
                amount: amountN,
                payment_method,
                description: description.trim() || undefined,
                treatment_id: linkKind === "treatment" ? linkId : undefined,
                examination_id: linkKind === "examination" ? linkId : undefined,
                amount_expected: openBefore,
            });
            toast(t("payment.create.toast.saved"), "success");
            if (isFinanceEmbed && onFinanceSaved) {
                onFinanceSaved();
                return;
            }
            if (fromCash) {
                navigate("/finance/cash");
            } else if (fromParam === "patient" && patientId) {
                navigate(`/patients/${patientId}#payment`);
            } else {
                navigate("/finance");
            }
        } catch (e) {
            setFormError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const retryLoadPatients = () => {
        setLoadError(null);
        setListLoading(true);
        void (async () => {
            try {
                setPatients(await listPatients());
                setLoadError(null);
            } catch (e) {
                setLoadError(errorMessage(e));
            } finally {
                setListLoading(false);
            }
        })();
    };

    if (listLoading) {
        return isFinanceEmbed ? (
            <div className="card products-detail-card" style={{ padding: 20 }}>
                <PageLoading label={t("common.loading_data")} />
            </div>
        ) : (
            <PageLoading label={t("common.loading_data")} />
        );
    }
    if (loadError) {
        return isFinanceEmbed ? (
            <div className="card products-detail-card" style={{ padding: 8 }}>
                <PageLoadError message={loadError} onRetry={retryLoadPatients} />
            </div>
        ) : (
            <PageLoadError message={loadError} onRetry={retryLoadPatients} />
        );
    }

    const backTarget = fromCash
        ? "/finance/cash"
        : fromFinance
          ? "/finance"
          : patientId
            ? `/patients/${patientId}#payment`
            : "/finance";
    const handleCancel = () => {
        if (isFinanceEmbed && onFinanceClose) onFinanceClose();
        else navigate(backTarget);
    };
    const hasClinicalLines = treatments.length + examinations.length > 0;
    const noLinks = !canListLines || !patientId || chartLoading || paymentLinkOptions.length <= 1;
    const disabledTreatmentNoOpen =
        linkKind === "treatment" && paymentNewMaxAmountEur != null && paymentNewMaxAmountEur <= PAYMENT_EUR_EPS;

    return (
        <div className={isFinanceEmbed ? undefined : "payment-create-page practice-workspace-page practice-workspace-page--form animate-fade-in"}>
            {!isFinanceEmbed ? (
                <WorkspacePageHeader
                    title={t("payment.create.title")}
                    back={{ onClick: () => navigate(backTarget), label: fromCash ? t("payment.create.back_cash") : t("payment.create.back_finance") }}
                />
            ) : null}

            {!canListLines ? (
                <Card>
                    <CardHeader
                        title={t("common.role_denied")}
                        subtitle={t("payment.create.denied_sub")}
                    />
                </Card>
            ) : (
                <PaymentFinanceOrPageWrap
                    isFinance={isFinanceEmbed}
                    embedVariant={variant === "cash" ? "cash" : "finance"}
                    onClose={handleCancel}
                >
                    <div className="payment-create-form">
                        {!isFinanceEmbed ? (
                            <p className="purchase-order-create-form__hint">
                                {t("payment.create.assignment_hint")}
                            </p>
                        ) : (
                            <p className="purchase-order-create-form__hint">
                                {t("payment.create.embed_hint")}
                            </p>
                        )}
                        {formError ? (
                            <p className="payment-create-form__error" role="alert">{formError}</p>
                        ) : null}
                            <PatientComboField
                                id="zc-patient"
                                label={t("payment.create.patient_label")}
                                patients={patients}
                                patientId={patientId}
                                onPatientIdChange={onPatientChange}
                            />
                            {patientId && !chartLoading ? (
                                <div
                                    className="rounded-lg px-4 py-3"
                                    style={{
                                        border: "1px solid var(--line)",
                                        background: "rgba(0,0,0,0.02)",
                                    }}
                                >
                                    <div className="form-label form-label--wide form-label--mb-10">
                                        {t("payment.create.history_title")}
                                    </div>
                                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--fg-3)" }}>
                                        {t("payment.create.history_hint")}
                                    </p>
                                    {paymentsPatientSorted.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                            {t("payment.create.history_empty")}
                                        </p>
                                    ) : (
                                        <div className="payment-hist-table-wrap">
                                            <table className="tbl tbl-payment-hist">
                                                <colgroup>
                                                    <col className="payment-hist-col-date" />
                                                    <col className="payment-hist-col-reference" />
                                                    <col className="payment-hist-col-amount" />
                                                    <col className="payment-hist-col-kind" />
                                                    <col className="payment-hist-col-status" />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th scope="col">{t("payment.create.history_col_date")}</th>
                                                        <th scope="col">{t("payment.create.history_col_ref")}</th>
                                                        <th scope="col" className="tbl-th-num">{t("payment.create.history_col_amount")}</th>
                                                        <th scope="col">{t("payment.create.history_col_kind")}</th>
                                                        <th scope="col">{t("payment.create.history_col_status")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paymentsPatientSorted.map((z) => {
                                                        const st = paymentStatusDisplay(z.status, t);
                                                        return (
                                                            <tr key={z.id}>
                                                                <td>{formatDate(z.created_at)}</td>
                                                                <td className="payment-hist-td-reference">{formatPaymentReferenceLine(z, treatments, examinations, t, tp)}</td>
                                                                <td className="tbl-td-num">{formatCurrency(z.amount)}</td>
                                                                <td>{paymentMethodLabel(z.payment_method, t)}</td>
                                                                <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                            {chartLoading ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>{t("payment.create.treatment_loading")}</p>
                            ) : null}
                            {noLinks && patientId && !chartLoading && !hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("payment.create.no_clinical_lines")}
                                </p>
                            ) : null}
                            {noLinks && patientId && !chartLoading && hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("payment.create.no_open_links")}
                                </p>
                            ) : null}
                            <Select
                                id="zc-payment-link"
                                label={t("payment.create.link_label")}
                                value={paymentLinkValue}
                                options={paymentLinkOptions}
                                disabled={!patientId || noLinks || chartLoading}
                                onChange={(e) => onPaymentLinkChange(e.target.value)}
                            />
                            {linkKind && linkId && patientId ? (
                                linkKind === "treatment"
                                    ? (() => {
                                        const selBh = treatments.find((b) => b.id === linkId);
                                        const gesamt =
                                            selBh?.total_cost != null && Number.isFinite(selBh.total_cost)
                                                ? selBh.total_cost
                                                : null;
                                        const hist = paymentHistoryForTreatment(paymentsPatient, patientId, linkId);
                                        const paidSum = sumPaymentsForTreatment(
                                            paymentsPatient,
                                            patientId,
                                            linkId,
                                        );
                                        const openNow = gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum) : null;
                                        const amountN = Number(String(amount).replace(",", "."));
                                        const add = Number.isFinite(amountN) && amountN > 0 ? amountN : 0;
                                        const openAfter =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum - add) : null;
                                        const previewCase =
                                            gesamt != null && gesamt > 0 && openAfter != null
                                                ? openAfter <= PAYMENT_EUR_EPS
                                                    ? "PAID"
                                                    : "PARTIALLY_PAID"
                                                : "PAID";
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div className="form-label form-label--wide form-label--mb-10">
                                                        {t("payment.create.treatment_cost_title")}
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("payment.create.cost_should")}</div>
                                                            <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : t("common.em_dash")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("payment.create.paid_so_far")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("payment.create.open_now")}</div>
                                                            <div
                                                                style={{
                                                                    fontWeight: 700,
                                                                    color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)",
                                                                }}
                                                            >
                                                                {openNow != null ? formatCurrency(openNow) : t("common.em_dash")}
                                                            </div>
                                                        </div>
                                                        {add > 0 && openAfter != null ? (
                                                            <div>
                                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                                    {t("payment.create.open_after")}
                                                                </div>
                                                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        {t("payment.create.treatment_history_title")}
                                                    </div>
                                                    {hist.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {hist.map((h) => {
                                                                const hs = paymentStatusDisplay(h.status, t);
                                                                return (
                                                                    <li key={h.id}>
                                                                        {formatDate(h.created_at)}
                                                                        {" · "}
                                                                        {formatCurrency(h.amount)}
                                                                        {" · "}
                                                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            {t("payment.create.treatment_history_empty")}
                                                        </p>
                                                    )}
                                                </div>
                                                <div
                                                    className="row"
                                                    style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}
                                                >
                                                    <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                                        {t("payment.create.preview_after_save")}
                                                    </span>
                                                    <Badge
                                                        variant={previewCase === "PAID"
                                                            ? "success"
                                                            : previewCase === "PARTIALLY_PAID"
                                                            ? "warning"
                                                            : "default"}
                                                    >
                                                        {previewCase === "PAID"
                                                            ? t("payment.create.preview_balanced")
                                                            : previewCase === "PARTIALLY_PAID"
                                                            ? t("payment.create.preview_still_open")
                                                            : previewCase}
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    })()
                                    : (() => {
                                        const histU = paymentHistoryForExamination(
                                            paymentsPatient,
                                            patientId,
                                            linkId,
                                        );
                                        const paidU = sumPaymentsForExamination(
                                            paymentsPatient,
                                            patientId,
                                            linkId,
                                        );
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div className="form-label form-label--wide form-label--mb-8">
                                                        {t("payment.create.examination_title")}
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("payment.create.cost_should")}</div>
                                                            <div style={{ fontWeight: 600 }}>{t("common.em_dash")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("payment.create.paid_sum")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                                        </div>
                                                    </div>
                                                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                                        {t("payment.create.examination_no_should_hint")}
                                                    </p>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        {t("payment.create.examination_history_title")}
                                                    </div>
                                                    {histU.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {histU.map((h) => {
                                                                const hu = paymentStatusDisplay(h.status, t);
                                                                return (
                                                                <li key={h.id}>
                                                                    {formatDate(h.created_at)}
                                                                    {" · "}
                                                                    {formatCurrency(h.amount)}
                                                                    {" · "}
                                                                    <Badge variant={hu.variant}>{hu.label}</Badge>
                                                                </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            {t("payment.create.examination_history_empty")}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()
                            ) : null}
                            <div className="payment-create-form__grid payment-create-form__grid--2">
                                <div>
                                    <Input
                                        id="zc-amount"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        max={paymentNewMaxAmountEur != null ? paymentNewMaxAmountEur : undefined}
                                        label={t("payment.create.payment_amount_label")}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onBlur={(e) => {
                                            if (paymentNewMaxAmountEur == null) return;
                                            const n = Number(String(e.target.value).replace(",", "."));
                                            if (!Number.isFinite(n) || n <= 0) return;
                                            if (n > paymentNewMaxAmountEur + PAYMENT_EUR_EPS) {
                                                setAmount(String(roundMoney2(paymentNewMaxAmountEur)));
                                                toast(
                                                    tp("payment.create.amount_max_toast", { amount: formatCurrency(paymentNewMaxAmountEur) }),
                                                    "info",
                                                );
                                            }
                                        }}
                                    />
                                    {paymentNewMaxAmountEur != null ? (
                                        <p className="purchase-order-create-form__note">
                                            {tp("payment.create.amount_max_hint", { amount: formatCurrency(paymentNewMaxAmountEur) })}
                                        </p>
                                    ) : null}
                                </div>
                                <Select
                                    id="zc-kind"
                                    label={t("payment.create.payment_method")}
                                    value={payment_method}
                                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                    options={paymentMethodSelectOptions(t)}
                                />
                            </div>
                            <div>
                                <Textarea
                                    id="zc-beschr"
                                    label={t("payment.create.desc_label")}
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                    {t("payment.create.desc_hint")}
                                </p>
                            </div>
                            <div className="payment-create-form__actions">
                                {linkKind === "treatment" && disabledTreatmentNoOpen ? (
                                    <span className="purchase-order-create-form__note" style={{ flex: "1 1 200px", marginInlineEnd: "auto" }}>
                                        {t("payment.create.treatment_no_open")}
                                    </span>
                                ) : null}
                                <Button type="button" variant="ghost" onClick={handleCancel} disabled={busy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submit()}
                                    disabled={
                                        busy
                                        || !patientId
                                        || !linkKind
                                        || !linkId
                                        || disabledTreatmentNoOpen
                                        || chartLoading
                                    }
                                >
                                    {t("payment.create.save_btn")}
                                </Button>
                            </div>
                    </div>
                </PaymentFinanceOrPageWrap>
            )}
        </div>
    );
}

export function PaymentCreatePanel(p: PaymentCreatePanelProps) {
    return <PaymentCreatePanelInner {...p} variant={p.variant ?? "page"} />;
}

export function PaymentCreatePage() {
    return <PaymentCreatePanelInner variant="page" />;
}

export function PaymentCashCreatePage() {
    return <PaymentCreatePanelInner variant="cash-page" />;
}
