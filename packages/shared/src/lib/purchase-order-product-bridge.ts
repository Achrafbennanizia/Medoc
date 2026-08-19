/** Session draft when New order → New product → back to New order. */

export const PURCHASE_ORDER_CREATE_DRAFT_KEY = "medoc:purchase-order-create-draft";

export type PurchaseOrderCreateDraft = {
    supplierId: string;
    pharmaConsultantId: string;
    itemProductId: string;
    quantity: string;
    unit: string;
    expected_on: string;
    remark: string;
    templateInputText: string;
};

export function emptyPurchaseOrderCreateDraft(): PurchaseOrderCreateDraft {
    return {
        supplierId: "",
        pharmaConsultantId: "",
        itemProductId: "",
        quantity: "1",
        unit: "",
        expected_on: "",
        remark: "",
        templateInputText: "",
    };
}

export function isPurchaseOrderCreateReturnPath(path: string | null | undefined): boolean {
    if (!path) return false;
    return path.includes("/purchase-orders/new");
}

export function resolveMasterIdByName(list: { id: string; name: string }[], name: string | null | undefined): string {
    const n = name?.trim();
    if (!n) return "";
    const hit = list.find((x) => x.name.trim() === n);
    return hit?.id ?? "";
}

export function savePurchaseOrderCreateDraft(draft: PurchaseOrderCreateDraft): void {
    try {
        sessionStorage.setItem(PURCHASE_ORDER_CREATE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        /* ignore quota / private mode */
    }
}

export function readPurchaseOrderCreateDraft(): PurchaseOrderCreateDraft | null {
    try {
        const raw = sessionStorage.getItem(PURCHASE_ORDER_CREATE_DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PurchaseOrderCreateDraft>;
        return { ...emptyPurchaseOrderCreateDraft(), ...parsed };
    } catch {
        return null;
    }
}

export function clearPurchaseOrderCreateDraft(): void {
    try {
        sessionStorage.removeItem(PURCHASE_ORDER_CREATE_DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

export function appendProductIdToReturnUrl(returnTo: string, productId: string): string {
    const q = returnTo.indexOf("?");
    const base = q >= 0 ? returnTo.slice(0, q) : returnTo;
    const params = new URLSearchParams(q >= 0 ? returnTo.slice(q + 1) : "");
    params.set("productId", productId);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}
