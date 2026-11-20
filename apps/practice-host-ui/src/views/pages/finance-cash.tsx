import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Patient, Payment } from "@/models/types";
import { itemValidationKey } from "@/lib/chart-validation";
import { filterReceptionCashQueue } from "@/lib/day-close";
import { allowed, parseRole } from "@/lib/rbac";
import { errorMessage, formatCurrency, formatDateTime, localIsoDate } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/finance-order-labels";
import { translatePluralUnit, useLocale, useT, useTParams } from "@/lib/i18n";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { usePageRefresh } from "../layouts/page-refresh";

/**
 * Reception-only cash overview: payments recorded today not yet confirmed in DayClose.
 */
export function FinanceCashPage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canWritePayment = role != null && allowed("finance.write", role);
    const toast = useToastStore((s) => s.add);

    const [payments, setPayments] = useState<Payment[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    /** `null` until validation rows load; then `payment:{id}` keys that are validated. */
    const [validatedPaymentKeys, setValidatedPaymentKeys] = useState<Set<string> | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const inFlight = useRef(false);

    const today = localIsoDate(new Date());

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent === true;
        if (silent && inFlight.current) return;
        inFlight.current = true;
        if (!silent) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const { listPaymentsPaged } = await import("@/systems/practice-host/controllers/payment.controller");
            const { listPatientsByIds } = await import("@/systems/practice-host/controllers/patient.controller");
            const resp = await listPaymentsPaged({
                page: 1,
                pageSize: 500,
                filter: { activeOn: today },
            });
            // Cash queue can span pages if a busy day exceeds 500; pull remaining pages.
            let all = resp.items;
            let page = resp.page;
            while (page * resp.pageSize < resp.total) {
                page += 1;
                const more = await listPaymentsPaged({
                    page,
                    pageSize: 500,
                    filter: { activeOn: today },
                });
                all = all.concat(more.items);
            }
            setPayments(all);
            const ids = [...new Set(all.map((z) => z.patient_id).filter(Boolean))];
            setPatients(ids.length ? await listPatientsByIds(ids) : []);
            const { listValidatedPaymentKeys } = await import("@/systems/practice-host/controllers/validation.controller");
            const validated = await listValidatedPaymentKeys(ids);
            if (validated) setValidatedPaymentKeys(validated);
        } catch (e) {
            const msg = errorMessage(e);
            if (silent) toast(tp("common.refresh_failed", { message: msg }), "error");
            else setLoadError(msg);
        } finally {
            inFlight.current = false;
            if (!silent) setLoading(false);
        }
    }, [today, toast, tp]);

    useEffect(() => {
        void load();
    }, [load]);

    usePageRefresh(() => {
        void load({ silent: true });
    });

    const patientName = useCallback(
        (id: string) => patients.find((p) => p.id === id)?.name ?? id,
        [patients],
    );

    const todayOpen = useMemo(
        () => filterReceptionCashQueue(payments, today).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [payments, today],
    );

    const todaySum = useMemo(() => todayOpen.reduce((s, z) => s + z.amount, 0), [todayOpen]);

    const paymentUnit = translatePluralUnit(locale, "page.finance_cash.payment_unit", todayOpen.length);

    if (loading) {
        return (
            <div className="finance-cash-page practice-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("page.finance_cash.title")} />
                <PageLoading label={t("page.finance_cash.loading")} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="finance-cash-page practice-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("page.finance_cash.title")} />
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    return (
        <div className="finance-cash-page practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                title={t("page.finance_cash.title")}
                subtitle={t("page.finance_cash.subtitle")}
                actions={
                    canWritePayment ? (
                        <Button type="button" onClick={() => navigate("/finance/cash/new")}>
                            {t("page.finance_cash.cta_new")}
                        </Button>
                    ) : null
                }
            />

            <div className="finance-cash-page__kpi card card-elevated">
                <div>
                    <div className="kpi-label-mini">{t("page.finance_cash.kpi_label")}</div>
                    <div className="finance-cash-page__kpi-value">{formatCurrency(todaySum)}</div>
                    <div className="finance-cash-page__kpi-meta">
                        {tp("page.finance_cash.kpi_meta", {
                            count: todayOpen.length,
                            unit: paymentUnit,
                            date: today,
                        })}
                    </div>
                </div>
                <Badge variant="warning">{t("page.finance_cash.badge_pending")}</Badge>
            </div>

            <section className="finance-cash-page__list card card-elevated tbl-data-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("page.finance_cash.list_title")}</div>
                        <div className="card-sub">{t("page.finance_cash.list_sub")}</div>
                    </div>
                </div>
                {todayOpen.length === 0 ? (
                    <div className="finance-cash-page__list-empty">
                        <EmptyState
                            title={t("page.finance_cash.empty_title")}
                            description={t("page.finance_cash.empty_desc")}
                            action={
                                canWritePayment
                                    ? {
                                          label: t("page.finance_cash.cta_new"),
                                          onClick: () => navigate("/finance/cash/new"),
                                      }
                                    : undefined
                            }
                        />
                    </div>
                ) : (
                    <div className="finance-cash-page__table-wrap tbl-scroll">
                        <table className="tbl tbl-cash">
                            <colgroup>
                                <col className="cash-col-time" />
                                <col className="cash-col-patient" />
                                <col className="cash-col-kind" />
                                <col className="cash-col-amount" />
                                <col className="cash-col-status" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="col">{t("common.time")}</th>
                                    <th scope="col">{t("common.patient")}</th>
                                    <th scope="col">{t("drawer.finance_tx.kind_kind")}</th>
                                    <th scope="col" className="tbl-th-num">
                                        {t("common.amount")}
                                    </th>
                                    <th scope="col">{t("common.status")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todayOpen.map((z) => (
                                    <tr key={z.id}>
                                        <td className="cash-td-time">{formatDateTime(z.created_at)}</td>
                                        <td className="cash-td-patient">
                                            <Link to={`/patients/${z.patient_id}`} className="tbl-link">
                                                {patientName(z.patient_id)}
                                            </Link>
                                        </td>
                                        <td className="cash-td-kind">{paymentMethodLabel(z.payment_method, t)}</td>
                                        <td className="tbl-td-num">{formatCurrency(z.amount)}</td>
                                        <td className="cash-td-status">
                                            {validatedPaymentKeys == null ? (
                                                <Badge variant="warning">{t("page.finance_cash.status_open")}</Badge>
                                            ) : validatedPaymentKeys.has(itemValidationKey("payment", z.id)) ? (
                                                <Badge variant="success">{t("enum.charts_status.validated")}</Badge>
                                            ) : (
                                                <Badge variant="warning">{t("patient.detail.tab.payment.status_need_validation")}</Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
