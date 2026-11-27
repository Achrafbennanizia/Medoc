/** Dashboard limits, insight dismissal and status labels. */
import { type PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import { purchaseOrderIsOverdue } from "@/lib/purchase-order-is-overdue";

export const DASHBOARD_PURCHASE_ORDERS_MAX = 10;
export const DASHBOARD_OPEN_CASH_MAX = 8;
export const DASHBOARD_PENDING_TASKS_MAX = 12;
export const CHARTS_QUEUE_POLL_MS = 15_000;
export const INSIGHTS_DISMISSED_KEY = "medoc.dashboard.insights.dismissed";

export function readInsightsDismissed(): boolean {
    try {
        return localStorage.getItem(INSIGHTS_DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
}

export function purchaseOrderWirePill(b: PurchaseOrder, t: (k: string) => string): { label: string; cls: string } {
    const od = purchaseOrderIsOverdue(b);
    if (od) return { label: `● ${t("dashboard.purchase_orders.status_late")}`, cls: "dashboard-wire-pill-status--late" };
    if (b.status === "IN_TRANSIT")
        return { label: `● ${t("dashboard.purchase_orders.status_transit")}`, cls: "dashboard-wire-pill-status--transit" };
    return { label: `● ${t("dashboard.purchase_orders.status_open")}`, cls: "dashboard-wire-pill-status--open" };
}

export function appointmentStatusLabel(status: string, t: (key: string) => string): string {
    const key = `dashboard.status.${status}`;
    const version = t(key);
    return version === key ? status : version;
}
