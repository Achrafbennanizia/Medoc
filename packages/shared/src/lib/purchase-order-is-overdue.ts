/** A purchase order is overdue when its expected date has passed and it is neither delivered nor cancelled. */
import { localYmd } from "./practice-clock";

export function purchaseOrderIsOverdue(order: { expected_on?: string | null; status: string }, today: string = localYmd()): boolean {
    if (!order.expected_on) return false;
    if (order.status === "DELIVERED" || order.status === "CANCELLED") return false;
    return order.expected_on < today;
}
