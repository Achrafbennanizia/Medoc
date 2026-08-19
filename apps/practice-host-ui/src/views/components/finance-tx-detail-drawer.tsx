import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import type { OrderStatus, PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import type { Payment } from "@/models/types";
import type { FinanceTxRow } from "@/lib/report-export";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    orderStatusDisplay,
    orderStatusOptions,
    referenceKurz,
    vorgangText,
    paymentStatusDisplay,
    paymentMethodLabel,
} from "@/lib/finance-order-labels";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { ExportIcon, PackageIcon, UsersIcon, XIcon } from "@/lib/icons";
import { Select } from "./ui/input";

function pillClass(variant: "success" | "warning" | "default"): string {
    if (variant === "success") return "pill green";
    if (variant === "warning") return "pill orange";
    return "pill grey";
}

export function financeTxRowKey(row: FinanceTxRow): string {
    return row.kind === "payment" ? `z-${row.z.id}` : `b-${row.b.id}`;
}

export type FinanceTxDetailDrawerProps = {
    row: FinanceTxRow;
    patientName: string;
    onClose: () => void;
    onOpenPurchaseOrder: (id: string) => void;
    onOpenChart: (patientId: string) => void;
    onReceiptExport?: (z: Payment) => void;
    onOrderStatusChange?: (b: PurchaseOrder, status: OrderStatus) => void;
    canUpdateOrderStatus?: boolean;
    canExportReceipt?: boolean;
    receiptBusy?: boolean;
    statusUpdatingOrderId?: string | null;
};

export function FinanceTxDetailDrawer({
    row,
    patientName,
    onClose,
    onOpenPurchaseOrder,
    onOpenChart,
    onReceiptExport,
    onOrderStatusChange,
    canUpdateOrderStatus = false,
    canExportReceipt = false,
    receiptBusy = false,
    statusUpdatingOrderId = null,
}: FinanceTxDetailDrawerProps) {
    const t = useT();
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const orderStatusSelectOptions = useMemo(() => orderStatusOptions(t), [t]);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".appointment-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const layer =
        row.kind === "purchase_order" ? (
            (() => {
                const b = row.b;
                const st = orderStatusDisplay(b.status, t);
                const bAmountEur = b.total_amount;
                const hasAmount = bAmountEur != null && Number.isFinite(bAmountEur);
                const amtLabel = hasAmount ? `−${formatCurrency(bAmountEur)}` : t("drawer.finance_tx.amount_open");
                return (
                    <>
                        <div className="appointment-drawer-head">
                            <span className={pillClass(st.variant)}>{st.label}</span>
                            <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="appointment-drawer-section">
                            <div className="appointment-drawer-eyebrow">{t("drawer.finance_tx.eyebrow_purchase_order")}</div>
                            <h2 id={titleId} className="appointment-drawer-title">
                                {b.item}
                            </h2>
                            <div className="appointment-drawer-sub">
                                {b.supplier}
                                {b.order_number ? ` · ${b.order_number}` : ""}
                            </div>
                        </div>
                        <div className="appointment-drawer-meta-row">
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("common.date")}</div>
                                <div className="appointment-drawer-meta-val">
                                    {format(parseISO(b.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                                </div>
                            </div>
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("common.amount")}</div>
                                <div className="appointment-drawer-meta-val">{amtLabel}</div>
                            </div>
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("common.quantity")}</div>
                                <div className="appointment-drawer-meta-val">
                                    {b.quantity != null ? `${b.quantity}${b.unit ? ` ${b.unit}` : ""}` : "—"}
                                </div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="appointment-drawer-eyebrow">{t("common.supplier")}</div>
                                <div className="appointment-drawer-meta-val">{b.supplier}</div>
                            </div>
                            {b.pharma_consultant ? (
                                <div className="ios-row">
                                    <div className="appointment-drawer-eyebrow">{t("common.contact")}</div>
                                    <div className="appointment-drawer-meta-val">{b.pharma_consultant}</div>
                                </div>
                            ) : null}
                            {b.expected_on ? (
                                <div className="ios-row">
                                    <div className="appointment-drawer-eyebrow">{t("common.expected")}</div>
                                    <div className="appointment-drawer-meta-val">{formatDate(b.expected_on)}</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="appointment-drawer-actions row">
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenPurchaseOrder(b.id)}>
                                <PackageIcon size={14} />
                                {t("drawer.finance_tx.btn_purchase_order")}
                            </button>
                        </div>
                        {canUpdateOrderStatus ? (
                            <div className="appointment-drawer-panel-foot">
                                <div className="appointment-drawer-section">
                                    <div className="appointment-drawer-eyebrow">{t("drawer.finance_tx.change_status")}</div>
                                    <Select
                                        id={`fin-drawer-best-status-${b.id}`}
                                        className="finance-payment-status-select w-full min-w-0"
                                        aria-label={`${t("common.status")}: ${b.item}`}
                                        value={b.status}
                                        disabled={statusUpdatingOrderId === b.id}
                                        onChange={(e) =>
                                            onOrderStatusChange?.(b, e.target.value as OrderStatus)
                                        }
                                        options={orderStatusSelectOptions.map((o) => ({
                                            value: o.value,
                                            label: o.label,
                                        }))}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </>
                );
            })()
        ) : (
            (() => {
                const z = row.z;
                const st = paymentStatusDisplay(z.status, t);
                const cur = formatCurrency(Math.abs(z.amount));
                const paymentAmt =
                    z.status === "CANCELLED"
                        ? `−${cur}`
                        : z.status === "PAID" || z.status === "PARTIALLY_PAID"
                          ? `+${cur}`
                          : `+${cur}`;
                const showReceipt =
                    canExportReceipt && (z.status === "PAID" || z.status === "PARTIALLY_PAID");
                return (
                    <>
                        <div className="appointment-drawer-head">
                            <span className={pillClass(st.variant)}>{st.label}</span>
                            <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="appointment-drawer-section">
                            <div className="appointment-drawer-eyebrow">{t("drawer.finance_tx.eyebrow_payment")}</div>
                            <h2 id={titleId} className="appointment-drawer-title">
                                {vorgangText(z, t)}
                            </h2>
                            <div className="appointment-drawer-sub">
                                {patientName} · {paymentMethodLabel(z.payment_method, t)}
                            </div>
                        </div>
                        <div className="appointment-drawer-meta-row">
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("common.date")}</div>
                                <div className="appointment-drawer-meta-val">
                                    {format(parseISO(z.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                                </div>
                            </div>
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("common.amount")}</div>
                                <div className="appointment-drawer-meta-val">{paymentAmt}</div>
                            </div>
                            <div>
                                <div className="appointment-drawer-eyebrow">{t("drawer.finance_tx.kind_kind")}</div>
                                <div className="appointment-drawer-meta-val">{paymentMethodLabel(z.payment_method, t)}</div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="appointment-drawer-eyebrow">{t("common.patient")}</div>
                                <div className="appointment-drawer-meta-val">{patientName}</div>
                            </div>
                            <div className="ios-row">
                                <div className="appointment-drawer-eyebrow">{t("common.reference")}</div>
                                <div className="appointment-drawer-meta-val">{referenceKurz(z, t)}</div>
                            </div>
                            {(z.description ?? "").trim() ? (
                                <div className="ios-row">
                                    <div className="appointment-drawer-eyebrow">{t("common.description")}</div>
                                    <div className="appointment-drawer-meta-val">{z.description}</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="appointment-drawer-actions row">
                            {showReceipt ? (
                                <button
                                    type="button"
                                    className="btn btn-subtle"
                                    disabled={receiptBusy}
                                    onClick={() => onReceiptExport?.(z)}
                                >
                                    <ExportIcon size={14} />
                                    {t("drawer.finance_tx.btn_receipt")}
                                </button>
                            ) : null}
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenChart(z.patient_id)}>
                                <UsersIcon size={14} />
                                {t("drawer.finance_tx.btn_chart")}
                            </button>
                        </div>
                    </>
                );
            })()
        );

    return createPortal(
        <div className="appointment-drawer-root" role="presentation">
            <button type="button" className="appointment-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="appointment-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="appointment-drawer-body-scroll">{layer}</div>
            </div>
        </div>,
        document.body,
    );
}
