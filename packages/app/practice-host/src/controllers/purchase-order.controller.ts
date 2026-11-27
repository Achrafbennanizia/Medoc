import type { z } from "zod";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { OrderStatus } from "@/models/types";
import { CreatePurchaseOrderSchema, UpdatePurchaseOrderSchema, parseOrThrow } from "@/lib/schemas";

export type { OrderStatus };

export interface PurchaseOrder {
    id: string;
    order_number: string | null;
    supplier: string;
    pharma_consultant: string | null;
    item: string;
    status: OrderStatus;
    expected_on: string | null;
    delivered_on: string | null;
    quantity: number;
    unit: string | null;
    remark: string | null;
    /** Order total on capture (inventory price × quantity), for finance. */
    total_amount?: number | null;
    created_by: string;
    ordered_for_staff_id?: string | null;
    paid_by_staff_id?: string | null;
    approved_by?: string | null;
    created_at: string;
    updated_at: string;
}

export type PurchaseOrderList = {
    items: PurchaseOrder[];
    hiddenDoctors?: string[];
};

export type CreatePurchaseOrder = z.input<typeof CreatePurchaseOrderSchema>;

/** Patch. Each field is optional; only provided fields are updated. */
export type UpdatePurchaseOrder = z.input<typeof UpdatePurchaseOrderSchema>;

export const listPurchaseOrders = (doctorId?: string) =>
    practiceSystem.invoke<PurchaseOrderList>("list_purchase_orders", {
        doctorId: doctorId || null,
    });

export const createPurchaseOrder = (data: CreatePurchaseOrder) => {
    const safe = parseOrThrow(CreatePurchaseOrderSchema, data);
    return practiceSystem.invoke<PurchaseOrder>("create_purchase_order", { data: safe });
};

export const updatePurchaseOrder = (id: string, data: UpdatePurchaseOrder) => {
    const safe = parseOrThrow(UpdatePurchaseOrderSchema, data);
    return practiceSystem.invoke<PurchaseOrder>("update_purchase_order", { id, data: safe });
};

export const updatePurchaseOrderStatus = (id: string, status: OrderStatus) =>
    practiceSystem.invoke<PurchaseOrder>("update_purchase_order_status", { id, status });

export const deletePurchaseOrder = (id: string) =>
    practiceSystem.invoke<void>("delete_purchase_order", { id });
