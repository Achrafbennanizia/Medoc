import type { Product } from "@/models/types";

export type ProductForm = {
    name: string;
    category: string;
    price: string;
    stock: string;
    min_stock: string;
    description: string;
    /** Order master data — optional link when creating a product. */
    supplierId: string;
    pharmaConsultantId: string;
};

export function emptyForm(): ProductForm {
    return {
        name: "",
        category: "",
        price: "",
        stock: "",
        min_stock: "",
        description: "",
        supplierId: "",
        pharmaConsultantId: "",
    };
}

export function toForm(p: Product): ProductForm {
    return {
        name: p.name,
        category: p.category,
        price: String(p.price),
        stock: String(p.stock),
        min_stock: String(p.min_stock),
        description: p.description ?? "",
        supplierId: "",
        pharmaConsultantId: "",
    };
}

export function hasMasterLinkSelection(f: ProductForm): boolean {
    return Boolean(f.supplierId.trim() && f.pharmaConsultantId.trim());
}

export function parseForm(
    f: ProductForm,
    opts?: { stockUi?: boolean; stockFallback?: Pick<Product, "stock" | "min_stock"> },
): {
    name: string;
    category: string;
    price: number;
    stock: number;
    min_stock: number;
    description: string | undefined;
} {
    const stockUi = opts?.stockUi !== false;
    const fallback = opts?.stockFallback;
    const amount = Math.trunc(Number(f.stock));
    return {
        name: f.name.trim(),
        category: f.category.trim(),
        price: Number(String(f.price).replace(",", ".")),
        stock: amount,
        min_stock: stockUi ? Math.trunc(Number(f.min_stock)) : (fallback?.min_stock ?? 0),
        description: f.description.trim() || undefined,
    };
}

export function formValid(f: ProductForm, opts?: { stockUi?: boolean }): boolean {
    if (!f.name.trim() || !f.category.trim()) return false;
    const price = Number(String(f.price).replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return false;
    if (opts?.stockUi !== false) {
        if (!Number.isFinite(Number(f.stock)) || !Number.isFinite(Number(f.min_stock))) return false;
    } else {
        const amount = Number(f.stock);
        if (!Number.isFinite(amount) || amount < 0) return false;
    }
    return true;
}
