import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
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
    created_at: string;
    updated_at: string;
}

export interface CreatePurchaseOrder {
    supplier: string;
    item: string;
    expected_on?: string | null;
    quantity: number;
    unit?: string | null;
    remark?: string | null;
    order_number?: string | null;
    pharma_consultant?: string | null;
    total_amount?: number | null;
}

/** Patch DTO. Each field is optional; only provided fields are updated. */
export interface UpdatePurchaseOrder {
    supplier?: string;
    item?: string;
    quantity?: number;
    unit?: string | null;
    expected_on?: string | null;
    remark?: string | null;
    order_number?: string | null;
    pharma_consultant?: string | null;
}

export const listPurchaseOrders = () =>
    practiceSystem.invoke<PurchaseOrder[]>("list_purchase_orders");

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
