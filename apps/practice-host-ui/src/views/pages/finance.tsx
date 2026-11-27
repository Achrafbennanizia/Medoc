import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FinanceDoctorCell, FinanceHiddenDoctorsNote, FinanceTxFilters } from "./finance-doctor";
import { useFinanceDoctors } from "./finance-doctor-data";
import { FinanceKpiCard, type KpiSubTone } from "./finance-kpi";
import { formatPctLocalized, kpisFromServer, paymentStatusFilter, type FinanceTxTab } from "./finance-kpi-data";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
    listPaymentsPaged,
    paymentFinanceKpis,
    type PaymentFinanceKpis,
} from "@/systems/practice-host/controllers/payment.controller";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import { listPurchaseOrders, updatePurchaseOrderStatus } from "@/systems/practice-host/controllers/purchase-order.controller";
import type { OrderStatus, PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import { parseRole, allowed, canReadFinance } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import {
    orderStatusDisplay,
    vorgangText,
    paymentStatusDisplay,
    paymentMethodLabel,
} from "@/lib/finance-order-labels";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { buildFinanceReportBundle, type FinanceTxRow } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import type { Payment, PaymentMethod } from "../../models/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { FinanceTxDetailDrawer, financeTxRowKey } from "../components/finance-tx-detail-drawer";
import { WorkspacePageHeader } from "../components/administration-page-header";
import type { DocumentKind } from "@/lib/document-template-schema";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { buildReceiptExportForPayment, canIssueReceipt, RECEIPT_DOCUMENT_KIND } from "@/lib/receipt-export-flow";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { HtmlDocumentExportPickerDialog } from "@/views/components/export-picker-dialog";
import { PracticeReadinessDialog } from "@/views/components/practice-readiness-dialog";
import { LAZY_PAGE_SIZE, mergeUniqueById } from "@/lib/lazy-list";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";
import { usePageRefresh } from "../layouts/page-refresh";
import { parseInstant } from "@/lib/practice-clock";

const PAYMENT_KIND_VALUES = ["CASH", "CARD", "BANK_TRANSFER", "INVOICE"] as const;

type FinanceTxRowLocal = FinanceTxRow;

function toFinanceRows(z: Payment[], b: PurchaseOrder[]): FinanceTxRowLocal[] {
    return [
        ...z.map((x) => ({ kind: "payment" as const, z: x })),
        ...b.map((x) => ({ kind: "purchase_order" as const, b: x })),
    ];
}

function rowSortTs(r: FinanceTxRowLocal): number {
    return parseInstant(r.kind === "payment" ? r.z.created_at : r.b.created_at)?.getTime() ?? 0;
}

export function FinancePage() {
    const t = useT();
    const tp = useTParams();
    const fd = useFinanceDoctors();
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWritePayment = role != null && allowed("finance.write", role);
    const canUpdateOrderStatus = role != null && allowed("purchase_order.write", role);
    const financeCache = readListSnapshot<{
        payments: Payment[];
        paymentTotal: number;
        paymentPage: number;
        orders: PurchaseOrder[];
        kpi: PaymentFinanceKpis;
    }>("finance");
    const [payments, setPayments] = useState<Payment[]>(() => financeCache?.payments ?? []);
    const [paymentTotal, setPaymentTotal] = useState(() => financeCache?.paymentTotal ?? 0);
    const [paymentPage, setPaymentPage] = useState(() => financeCache?.paymentPage ?? 0);
    const [paymentsLoadingMore, setPaymentsLoadingMore] = useState(false);
    const [purchase_orders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => financeCache?.orders ?? []);
    const [patientMap, setPatientMap] = useState<Map<string, string>>(() => new Map());
    const [txTab, setTxTab] = useState<FinanceTxTab>("all");
    const [kindFilter, setKindFilter] = useState<"ALL" | PaymentMethod>("ALL");
    const [doctorFilter, setDoctorFilter] = useState("");
    const [collectedByFilter, setCollectedByFilter] = useState("");
    const [hiddenDoctors, setHiddenDoctors] = useState<string[]>([]);
    const [selectedTxKey, setSelectedTxKey] = useState<string | null>(null);
    const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(() => !financeCache);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [kpiMtd, setKpiMtd] = useState(() =>
        kpisFromServer(
            financeCache?.kpi ?? {
                incomeMtd: 0,
                incomePrevMtd: 0,
                cancelledMtd: 0,
                cancelledPrevMtd: 0,
                openCount: 0,
                openSum: 0,
            },
        ),
    );
    const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);
    const [practiceGuardKind, setPracticeGuardKind] = useState<DocumentKind | null>(null);
    const [htmlDocExport, setHtmlDocExport] = useState<{
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
    } | null>(null);
    const toast = useToastStore((s) => s.add);
    const loadMoreLock = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const filtersReady = useRef(false);

    const finTxTabOptions = useMemo(
        () => [
            { value: "all" as const, label: t("common.all") },
            { value: "income" as const, label: t("page.finance.income") },
            { value: "expense" as const, label: t("page.finance.expenses") },
        ],
        [t],
    );

    const finTxKindOptions = useMemo(
        () => [
            { value: "ALL" as const, label: t("page.finance.all_payment_types") },
            ...PAYMENT_KIND_VALUES.map((value) => ({
                value,
                label: paymentMethodLabel(value, t),
            })),
        ],
        [t],
    );

    const financeFilterLabel = useCallback(
        (tab: FinanceTxTab, kind: "ALL" | PaymentMethod) => {
            const tabLabel =
                tab === "all"
                    ? t("page.finance.all_transactions")
                    : tab === "income"
                      ? t("page.finance.income")
                      : t("page.finance.expenses_storno");
            const kindLabel = kind === "ALL" ? t("page.finance.all_payment_types").toLowerCase() : paymentMethodLabel(kind, t);
            return `${tabLabel} · ${kindLabel}`;
        },
        [t],
    );

    const hydratePatientNames = useCallback(async (rows: Payment[]) => {
        const missing = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))];
        if (missing.length === 0) return;
        try {
            const pats = await listPatientsByIds(missing);
            setPatientMap((prev) => {
                const next = new Map(prev);
                for (const p of pats) next.set(p.id, p.name);
                return next;
            });
        } catch {
            /* names stay as ids */
        }
    }, []);

    const loadPaymentsPage = useCallback(
        async (page: number, replace: boolean) => {
            const status = paymentStatusFilter(txTab);
            const resp = await listPaymentsPaged({
                page,
                pageSize: LAZY_PAGE_SIZE,
                filter: {
                    ...(status ? { status } : {}),
                    ...(kindFilter !== "ALL" ? { paymentMethod: kindFilter } : {}),
                    ...(doctorFilter ? { doctorId: doctorFilter } : {}),
                    ...(collectedByFilter ? { collectedBy: collectedByFilter } : {}),
                },
            });
            setHiddenDoctors(resp.hiddenDoctors ?? []);
            setPaymentTotal(resp.total);
            setPaymentPage(resp.page);
            setPayments((prev) => (replace ? resp.items : mergeUniqueById(prev, resp.items)));
            void hydratePatientNames(resp.items);
            return resp;
        },
        [txTab, kindFilter, doctorFilter, collectedByFilter, hydratePatientNames],
    );

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setListLoading(true);
                setLoadError(null);
            }
            try {
                const [kpi, ordersResp] = await Promise.all([paymentFinanceKpis(), listPurchaseOrders()]);
                setKpiMtd(kpisFromServer(kpi));
                setPurchaseOrders(ordersResp.items);
                const paymentsPage = await loadPaymentsPage(1, true);
                writeListSnapshot("finance", {
                    payments: paymentsPage.items,
                    paymentTotal: paymentsPage.total,
                    paymentPage: paymentsPage.page,
                    orders: ordersResp.items,
                    kpi,
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (isInitial) {
                    setLoadError(msg);
                } else {
                    toast(tp("common.refresh_failed", { message: msg }));
                }
            } finally {
                if (isInitial) setListLoading(false);
            }
        },
        [loadPaymentsPage, toast, tp, setPurchaseOrders],
    );

    const financeHadCache = useRef(financeCache != null);
    useEffect(() => {
        void load({ initial: !financeHadCache.current });
        financeHadCache.current = false;
    }, [load]);

    usePageRefresh(() => {
        void load({ initial: false });
    });

    useEffect(() => {
        if (!filtersReady.current) {
            filtersReady.current = true;
            return;
        }
        setListLoading(true);
        void loadPaymentsPage(1, true)
            .catch((e) => toast(tp("common.refresh_failed", { message: errorMessage(e) }), "error"))
            .finally(() => setListLoading(false));
    }, [txTab, kindFilter, loadPaymentsPage, toast, tp]);

    const canReadFinanceFlag = role != null && canReadFinance(role);
    const allRows = useMemo(() => toFinanceRows(payments, purchase_orders), [payments, purchase_orders]);
    const filteredRows = useMemo(() => {
        return allRows.filter((row) => {
            if (row.kind === "purchase_order") {
                if (txTab === "income" || doctorFilter || collectedByFilter) return false;
                if (kindFilter !== "ALL") return false;
                return txTab === "all" || txTab === "expense";
            }
            return true;
        });
    }, [allRows, txTab, kindFilter, doctorFilter, collectedByFilter]);
    const sortedRows = useMemo(
        () => [...filteredRows].sort((a, b) => rowSortTs(b) - rowSortTs(a)),
        [filteredRows],
    );
    const selectedRow = useMemo(
        () => sortedRows.find((r) => financeTxRowKey(r) === selectedTxKey) ?? null,
        [sortedRows, selectedTxKey],
    );
    const paymentsHaveMore = paymentPage * LAZY_PAGE_SIZE < paymentTotal;

    const onTxScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || !paymentsHaveMore || paymentsLoadingMore || loadMoreLock.current) return;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 120) return;
        loadMoreLock.current = true;
        setPaymentsLoadingMore(true);
        void loadPaymentsPage(paymentPage + 1, false)
            .catch((e) => toast(tp("common.refresh_failed", { message: errorMessage(e) }), "error"))
            .finally(() => {
                setPaymentsLoadingMore(false);
                loadMoreLock.current = false;
            });
    }, [paymentsHaveMore, paymentsLoadingMore, loadPaymentsPage, paymentPage, toast, tp, setPaymentsLoadingMore]);

    useEffect(() => {
        if (selectedTxKey && !sortedRows.some((r) => financeTxRowKey(r) === selectedTxKey)) {
            setSelectedTxKey(null);
        }
    }, [sortedRows, selectedTxKey]);

    const buildExportBundle = useCallback(() => {
        return buildFinanceReportBundle(
            sortedRows,
            patientMap,
            kpiMtd,
            financeFilterLabel(txTab, kindFilter),
        );
    }, [sortedRows, patientMap, kpiMtd, txTab, kindFilter, financeFilterLabel]);

    const monthSubtitle = useMemo(
        () => format(new Date(), "LLLL yyyy", { locale: dateFnsLocale }),
        [dateFnsLocale],
    );

    if (listLoading) {
        return (
            <div className="practice-workspace-page animate-fade-in--sticky-safe">
                <WorkspacePageHeader title={t("page.finance.title")} />
                <PageLoading label={t("page.finance.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="practice-workspace-page animate-fade-in--sticky-safe">
                <WorkspacePageHeader title={t("page.finance.title")} />
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            </div>
        );
    }

    const handleReceiptExport = async (z: Payment) => {
        const readiness = checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), RECEIPT_DOCUMENT_KIND);
        if (!readiness.ready) {
            setPracticeGuardKind(RECEIPT_DOCUMENT_KIND);
            return;
        }
        // A Quittung confirms money received; an open payment gets an invoice instead.
        if (!canIssueReceipt(z)) {
            toast(t("page.finance.toast_receipt_unpaid"), "info");
            return;
        }
        setReceiptBusyId(z.id);
        try {
            setHtmlDocExport(await buildReceiptExportForPayment(z));
        } catch (e) {
            toast(tp("page.finance.toast_receipt_failed", { message: errorMessage(e) }), "error");
        } finally {
            setReceiptBusyId(null);
        }
    };

    const handleOrderStatusChange = async (b: PurchaseOrder, status: OrderStatus) => {
        if (status === b.status) return;
        setStatusUpdatingOrderId(b.id);
        try {
            const updated = await updatePurchaseOrderStatus(b.id, status);
            setPurchaseOrders((list) => list.map((row) => (row.id === updated.id ? updated : row)));
            toast(t("page.finance.toast_order_status"));
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally {
            setStatusUpdatingOrderId(null);
        }
    };

    const localeTag = dateFnsLocale.code ?? "de";
    const stPrevM = kpiMtd.cancelledPrevMtd;
    const incomeSub =
        kpiMtd.incomeDeltaPct == null
            ? { s: t("page.finance.kpi_no_compare"), t: "muted" as KpiSubTone }
            : {
                  s: tp("page.finance.kpi_vs_prev", {
                      arrow: kpiMtd.incomeDeltaPct >= 0 ? "↑" : "↓",
                      pct: formatPctLocalized(kpiMtd.incomeDeltaPct, localeTag),
                  }),
                  t: (kpiMtd.incomeDeltaPct >= 0 ? "up" : "down") as KpiSubTone,
              };
    const stDeltaNum = kpiMtd.stDeltaPct;
    const stSub =
        kpiMtd.st === 0 && stPrevM === 0
            ? { s: t("page.finance.kpi_no_storno_month"), t: "muted" as KpiSubTone }
            : stDeltaNum == null
              ? { s: "—", t: "muted" as KpiSubTone }
              : {
                    s: tp("page.finance.kpi_vs_prev", {
                        arrow: (stDeltaNum as number) >= 0 ? "↑" : "↓",
                        pct: formatPctLocalized(stDeltaNum as number, localeTag),
                    }),
                    t: ((stDeltaNum as number) > 0 ? "down" : "up") as KpiSubTone,
                };
    const profitSub: { s: string; t: KpiSubTone } = {
        s: t("page.finance.kpi_net_sub"),
        t: "muted",
    };

    return (
        <div className="finance-page animate-fade-in" style={{ gap: 0 }}>
            <div className="finance-page__head">
                <WorkspacePageHeader
                    title={t("page.finance.title")}
                    subtitle={tp("page.finance.subtitle", {
                        month: monthSubtitle,
                        payments: paymentTotal,
                        purchase_orders: purchase_orders.length,
                    })}
                    actions={
                        <>
                            {canReadFinanceFlag ? (
                                <ReportExportToolbar
                                    dialogTitle={t("page.finance.export_title")}
                                    buildBundle={buildExportBundle}
                                    defaultFormat="pdf"
                                    // TODO(later): restore Finance Import — see docs/coordination/todos-deferred-ui-blinds.md
                                    // showImport
                                    legacyCsv={{ rows: sortedRows, patientNames: patientMap }}
                                />
                            ) : null}
                            {canReadFinanceFlag ? (
                                <Button type="button" variant="secondary" onClick={() => navigate("/purchase-orders/new")}>
                                    {t("page.finance.cta_new_purchase_order")}
                                </Button>
                            ) : null}
                            {canWritePayment ? (
                                <Button type="button" onClick={() => navigate("/finance/new")}>
                                    {t("page.finance.cta_new_payment")}
                                </Button>
                            ) : null}
                        </>
                    }
                />

                <div className="finance-kpi-row" aria-label={t("page.finance.aria_kpi_month")}>
                    <FinanceKpiCard
                        tone="mint"
                        label={t("page.finance.kpi_income_mtd")}
                        value={formatCurrency(kpiMtd.incomeMtd)}
                        iconKey="/finance"
                        iconBg="rgba(20, 139, 76, 0.12)"
                        iconColor="#148B4C"
                        sub={incomeSub.s}
                        subTone={incomeSub.t}
                    />
                    <FinanceKpiCard
                        tone="red"
                        label={t("page.finance.kpi_storno_mtd")}
                        value={formatCurrency(kpiMtd.st)}
                        iconKey="/balance-sheet"
                        iconBg="rgba(255, 59, 48, 0.12)"
                        iconColor="var(--red)"
                        sub={stSub.s}
                        subTone={stSub.t}
                    />
                    <FinanceKpiCard
                        tone="blue"
                        label={t("page.finance.kpi_net_mtd")}
                        value={formatCurrency(kpiMtd.profitMtd)}
                        iconKey="/statistics"
                        iconBg="var(--blue-soft)"
                        iconColor="var(--blue)"
                        sub={profitSub.s}
                        subTone={profitSub.t}
                    />
                    <FinanceKpiCard
                        tone="amber"
                        label={t("page.finance.kpi_open_items")}
                        value={formatCurrency(kpiMtd.openSum)}
                        iconKey="Calendar"
                        iconBg="var(--yellow-soft)"
                        iconColor="#B45309"
                        sub={tp("page.finance.kpi_open_sub", { count: kpiMtd.openCount })}
                        subTone="muted"
                    />
                </div>
            </div>

            <div className="finance-workspace finance-workspace--single">
            <div className="finance-workspace__list">
                <div className="finance-tx-section-head">
                    <h2 className="finance-tx-section-title">{t("page.finance.transactions")}</h2>
                    <div className="finance-tx-section-head__controls">
                        <FinanceTxFilters
                            fd={fd}
                            txTab={txTab}
                            kindFilter={kindFilter}
                            doctorFilter={doctorFilter}
                            collectedBy={collectedByFilter}
                            hiddenDoctors={hiddenDoctors}
                            txTabOptions={finTxTabOptions}
                            kindOptions={finTxKindOptions}
                            onTxTab={(v) => setTxTab(v as FinanceTxTab)}
                            onKind={(v) => setKindFilter(v as "ALL" | PaymentMethod)}
                            onDoctor={setDoctorFilter}
                            onCollectedBy={setCollectedByFilter}
                        />
                        <div className="finance-tx-section-head__meta">
                            <span className="finance-tx-count">
                                {tp("page.finance.entries_count", { count: filteredRows.length })}
                            </span>
                            {txTab !== "all" || kindFilter !== "ALL" || doctorFilter || collectedByFilter ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setTxTab("all");
                                        setKindFilter("ALL");
                                        setDoctorFilter("");
                                        setCollectedByFilter("");
                                    }}
                                >
                                    {t("common.reset")}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
                <FinanceHiddenDoctorsNote fd={fd} ids={hiddenDoctors} />
                {sortedRows.length === 0 ? (
                    <EmptyState
                        icon="💰"
                        title={t("page.finance.empty_filter_title")}
                        description={t("page.finance.empty_filter_desc")}
                    />
                ) : (
                    <div className="card finance-tx-table-card tbl-data-card card--overflow-visible">
                        <div className="tbl-scroll finance-tx__scroll" ref={scrollRef} onScroll={onTxScroll}>
                            <table className={`tbl tbl-finance-tx${fd.show ? " tbl-finance-tx--doctor" : ""}`} data-tbl-no-autosize>
                                <colgroup>
                                    <col className="fin-tx-col-date" />
                                    <col className="fin-tx-col-vorgang" />
                                    <col className="fin-tx-col-gegenpartei" />
                                    {fd.show ? <col className="fin-tx-col-doctor" /> : null}
                                    <col className="fin-tx-col-amount" />
                                    <col className="fin-tx-col-status" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th scope="col">{t("common.date")}</th>
                                        <th scope="col">{t("common.procedure")}</th>
                                        <th scope="col">{t("common.counterparty")}</th>
                                        {fd.show ? <th scope="col">{t("page.finance.col_doctor")}</th> : null}
                                        <th scope="col" className="tbl-th-num">{t("common.amount")}</th>
                                        <th scope="col">{t("common.status")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((row) => {
                                        const rowKey = financeTxRowKey(row);
                                        const isSelected = selectedTxKey === rowKey;
                                        const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                setSelectedTxKey(rowKey);
                                            }
                                        };
                                        if (row.kind === "purchase_order") {
                                            const b = row.b;
                                            const bst = orderStatusDisplay(b.status, t);
                                            const bAmountEur = b.total_amount;
                                            const hasAmount = bAmountEur != null && Number.isFinite(bAmountEur);
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    className={[
                                                        "fin-tx-row",
                                                        "purchase-orders-row--clickable",
                                                        isSelected ? "fin-tx-row--selected" : "",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                    tabIndex={0}
                                                    role="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => setSelectedTxKey(rowKey)}
                                                    onKeyDown={onRowKeyDown}
                                                >
                                                    <td className="fin-tx-td-date">{formatDate(b.created_at)}</td>
                                                    <td className="fin-tx-td-vorgang">
                                                        <div className="finance-tx-v1">{t("page.finance.new_order_label")}</div>
                                                        <div className="finance-tx-v2">
                                                            {b.item}
                                                            {b.order_number ? ` · ${b.order_number}` : ""}
                                                        </div>
                                                        {hasAmount ? (
                                                            <div className="finance-tx-v2" style={{ color: "var(--fg-2)" }}>
                                                                {formatCurrency(bAmountEur)}
                                                                {b.quantity != null && b.quantity > 1 ? ` · ${b.quantity}×` : ""}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="fin-tx-td-gegenpartei">
                                                        <span className="payment-td-clip" title={b.supplier}>
                                                            {b.supplier}
                                                        </span>
                                                    </td>
                                                    <FinanceDoctorCell fd={fd} />
                                                    <td className="tbl-td-num fin-tx-td-amount">
                                                        <span
                                                            className="finance-amt finance-amt--out"
                                                            title={
                                                                hasAmount
                                                                    ? t("page.finance.tx_amount_hint_open")
                                                                    : t("page.finance.tx_amount_hint_missing")
                                                            }
                                                        >
                                                            {hasAmount
                                                                ? `−${formatCurrency(bAmountEur)}`
                                                                : t("drawer.finance_tx.amount_open")}
                                                        </span>
                                                    </td>
                                                    <td className="fin-tx-td-status">
                                                        <Badge variant={bst.variant}>{bst.label}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        const z = row.z;
                                        const st = paymentStatusDisplay(z.status, t);
                                        const patientName = patientMap.get(z.patient_id) ?? "—";
                                        const kindLabel = paymentMethodLabel(z.payment_method, t);
                                        const cur = formatCurrency(Math.abs(z.amount));
                                        const paymentAmt =
                                            z.status === "CANCELLED"
                                                ? { cls: "finance-amt--out" as const, text: `−${cur}` }
                                                : z.status === "PAID" || z.status === "PARTIALLY_PAID"
                                                  ? { cls: "finance-amt--in" as const, text: `+${cur}` }
                                                  : { cls: "finance-amt--warn" as const, text: `+${cur}` };
                                        return (
                                            <tr
                                                key={rowKey}
                                                className={[
                                                    "fin-tx-row",
                                                    "purchase-orders-row--clickable",
                                                    isSelected ? "fin-tx-row--selected" : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                tabIndex={0}
                                                role="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedTxKey(rowKey)}
                                                onKeyDown={onRowKeyDown}
                                            >
                                                <td className="fin-tx-td-date">{formatDate(z.created_at)}</td>
                                                <td className="fin-tx-td-vorgang">
                                                    <div className="finance-tx-v1">{vorgangText(z, t)}</div>
                                                    <div className="finance-tx-v2">{kindLabel}</div>
                                                </td>
                                                <td className="fin-tx-td-gegenpartei">
                                                    <span className="payment-td-clip" title={patientName}>
                                                        {patientName}
                                                    </span>
                                                </td>
                                                <FinanceDoctorCell fd={fd} payment={z} />
                                                <td className="tbl-td-num fin-tx-td-amount">
                                                    <span className={["finance-amt", paymentAmt.cls].join(" ")}>
                                                        {paymentAmt.text}
                                                    </span>
                                                </td>
                                                <td className="fin-tx-td-status">
                                                    <Badge variant={st.variant}>{st.label}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {paymentsLoadingMore ? (
                                <div className="card-sub" style={{ padding: "12px 16px", textAlign: "center" }}>
                                    {t("common.loading")}
                                </div>
                            ) : paymentsHaveMore ? (
                                <div className="card-sub" style={{ padding: "8px 16px", textAlign: "center" }}>
                                    {tp("page.finance.entries_count", { count: `${payments.length} / ${paymentTotal}` })}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
            </div>

            {selectedRow ? (
                <FinanceTxDetailDrawer
                    row={selectedRow}
                    patientName={
                        selectedRow.kind === "payment"
                            ? patientMap.get(selectedRow.z.patient_id) ?? "—"
                            : selectedRow.b.supplier
                    }
                    onClose={() => setSelectedTxKey(null)}
                    onOpenPurchaseOrder={(id) => navigate(`/purchase-orders?purchase_order=${encodeURIComponent(id)}`)}
                    onOpenChart={(patientId) => navigate(`/patients/${patientId}#payment`)}
                    onReceiptExport={(z) => void handleReceiptExport(z)}
                    onOrderStatusChange={handleOrderStatusChange}
                    canUpdateOrderStatus={canUpdateOrderStatus}
                    canExportReceipt={canReadFinanceFlag}
                    receiptBusy={receiptBusyId != null}
                    statusUpdatingOrderId={statusUpdatingOrderId}
                />
            ) : null}

            <PracticeReadinessDialog
                open={practiceGuardKind != null}
                documentKind={practiceGuardKind ?? "receipt"}
                result={checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), practiceGuardKind ?? "receipt")}
                onClose={() => setPracticeGuardKind(null)}
            />
            {htmlDocExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlDocExport(null)}
                    templateKind={htmlDocExport.kind}
                    exportPreviewTitle={htmlDocExport.exportPreviewTitle}
                    suggestedBasename={htmlDocExport.suggestedBasename}
                    bundle={htmlDocExport.bundle}
                />
            ) : null}

        </div>
    );
}
