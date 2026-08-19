import type { OrderStatus } from "./enums.generated";

type TFn = (key: string) => string;

const PAYMENT_METHOD_KEYS: Record<string, string> = {
    CASH: "enum.payment_method.cash",
    CARD: "enum.payment_method.card",
    BANK_TRANSFER: "enum.payment_method.bankTransfer",
    INVOICE: "enum.payment_method.invoice",
};

const PAYMENT_STATUS_KEYS: Record<string, { variant: "success" | "warning" | "default"; key: string }> = {
    PAID: { variant: "success", key: "enum.payment_status.paid" },
    PARTIALLY_PAID: { variant: "warning", key: "enum.payment_status.partiallyPaid" },
    OUTSTANDING: { variant: "warning", key: "enum.payment_status.outstanding" },
    CANCELLED: { variant: "default", key: "enum.payment_status.cancelled" },
};

const ORDER_STATUS_KEYS: Record<OrderStatus, { variant: "success" | "warning" | "default"; key: string }> = {
    OPEN: { variant: "warning", key: "page.purchase_orders.status.open" },
    IN_TRANSIT: { variant: "warning", key: "page.purchase-orders.status.inTransit" },
    DELIVERED: { variant: "success", key: "page.purchase-orders.status.delivered" },
    CANCELLED: { variant: "default", key: "page.purchase-orders.status.cancelled" },
};

export function paymentMethodLabel(kind: string, t: TFn): string {
    const key = PAYMENT_METHOD_KEYS[kind];
    return key ? t(key) : kind;
}

export function paymentStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    const row = PAYMENT_STATUS_KEYS[s];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: s || "—" };
}

export function orderStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const row = ORDER_STATUS_KEYS[status as OrderStatus];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: status };
}

export function referenceKurz(
    z: { treatment_id?: string | null; examination_id?: string | null },
    t: TFn,
): string {
    if (z.treatment_id) return t("enum.reference.treatment");
    if (z.examination_id) return t("enum.reference.examination");
    return t("enum.reference.direct_payment");
}

export function vorgangText(
    z: { treatment_id?: string | null; examination_id?: string | null; description?: string | null },
    t: TFn,
): string {
    const b = referenceKurz(z, t);
    const note = (z.description ?? "").trim();
    const direct = t("enum.reference.direct_payment");
    if (note) return b === direct ? note : `${b} — ${note}`;
    return b;
}

export const ORDER_STATUS_OPTIONS: readonly OrderStatus[] = ["OPEN", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

export function orderStatusOptions(t: TFn): readonly { value: OrderStatus; label: string }[] {
    return ORDER_STATUS_OPTIONS.map((value) => ({
        value,
        label: orderStatusDisplay(value, t).label,
    }));
}
