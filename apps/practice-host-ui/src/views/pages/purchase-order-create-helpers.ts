/** Pure helpers for the new-order form (kept out of the page file for size). */
import type { PurchaseOrderCreateDraft } from "@/lib/purchase-order-product-bridge";
import { formatCurrency } from "@/lib/utils";
import { localYmd } from "@/lib/practice-clock";
import type { SupplierPharmaTemplate } from "@/models/types";

/** Display text for quick-select template (supplier · contact · product). */
export function formatTemplateDatalistLine(
    version: SupplierPharmaTemplate,
    tp: (key: string, params: Record<string, string | number>) => string,
): string {
    const prod =
        version.product_active === 0
            ? tp("page.purchase_order.create.template_line_inactive", { name: version.product_name })
            : `${version.product_name} · ${version.product_category} · ${formatCurrency(version.product_price)}`;
    return tp("page.purchase_order.create.template_line", {
        supplier: version.supplier_name,
        contact: version.pharma_consultant_name,
        product: prod,
    });
}

export function buildTemplatesDatalistRows(
    templates: SupplierPharmaTemplate[],
    tp: (key: string, params: Record<string, string | number>) => string,
) {
    const seen = new Map<string, number>();
    const rows: { version: SupplierPharmaTemplate; label: string }[] = [];
    for (const version of templates) {
        const line = formatTemplateDatalistLine(version, tp);
        const c = (seen.get(line) ?? 0) + 1;
        seen.set(line, c);
        const label = c > 1 ? `${line} · #${version.id.slice(0, 8)}` : line;
        rows.push({ version, label });
    }
    return rows;
}

export function validatePurchaseOrderCreateForm(
    f: PurchaseOrderCreateDraft,
    productCount: number,
    t: (key: string) => string,
): string | null {
    const quantity = Number(f.quantity);
    if (!f.supplierId.trim()) return t("page.purchase_order.create.validation.supplier_required");
    if (productCount < 1) return t("page.purchase_order.create.validation.products_required");
    if (!f.itemProductId.trim()) return t("page.purchase_order.create.validation.article_required");
    if (!Number.isFinite(quantity) || quantity <= 0) return t("page.purchase_order.create.validation.quantity_positive");
    if (f.expected_on && f.expected_on < localYmd()) return t("page.purchase_order.create.validation.date_past");
    return null;
}

export function masterName(list: { id: string; name: string }[], id: string): string {
    return list.find((x) => x.id === id)?.name.trim() ?? "";
}
