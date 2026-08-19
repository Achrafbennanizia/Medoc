import { useId } from "react";
import type { ProductForm } from "@/lib/product-form-model";
import { PRODUCT_STOCK_UI_ENABLED } from "@/lib/catalog-menu-flags";
import { useT } from "@/lib/i18n";
import { Input, Select, Textarea } from "./ui/input";

export type ProductMasterOption = { id: string; name: string };

export function ProductFormFields({
    form,
    setForm,
    idPrefix,
    categorySuggestions,
    showMasterLink = false,
    suppliers = [],
    pharma_consultant = [],
}: {
    form: ProductForm;
    setForm: (f: ProductForm | ((p: ProductForm) => ProductForm)) => void;
    idPrefix: string;
    categorySuggestions: string[];
    /** Supplier + pharma contact — shown on “New product” only. */
    showMasterLink?: boolean;
    suppliers?: ProductMasterOption[];
    pharma_consultant?: ProductMasterOption[];
}) {
    const t = useT();
    const categoryDatalistId = useId();
    const masterPlaceholder = t("page.orderMaster.select_placeholder");
    const supplierOptions = [
        { value: "", label: masterPlaceholder },
        ...suppliers.map((x) => ({ value: x.id, label: x.name })),
    ];
    const contactOptions = [
        { value: "", label: masterPlaceholder },
        ...pharma_consultant.map((x) => ({ value: x.id, label: x.name })),
    ];
    return (
        <>
            <Input
                id={`${idPrefix}-name`}
                label={t("common.name")}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <div>
                <Input
                    id={`${idPrefix}-kat`}
                    label={t("common.category")}
                    value={form.category}
                    list={categoryDatalistId}
                    autoComplete="off"
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                />
                <datalist id={categoryDatalistId}>
                    {categorySuggestions.map((k) => (
                        <option key={k} value={k} />
                    ))}
                </datalist>
            </div>
            <Input
                id={`${idPrefix}-price`}
                type="number"
                min={0}
                step="0.01"
                label={t("common.price_eur")}
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            />
            {PRODUCT_STOCK_UI_ENABLED ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        id={`${idPrefix}-stock`}
                        type="number"
                        label={t("common.stock")}
                        value={form.stock}
                        onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                    />
                    <Input
                        id={`${idPrefix}-mindest`}
                        type="number"
                        label={t("common.min_stock")}
                        value={form.min_stock}
                        onChange={(e) => setForm((p) => ({ ...p, min_stock: e.target.value }))}
                    />
                </div>
            ) : (
                <Input
                    id={`${idPrefix}-amount`}
                    type="number"
                    min={0}
                    step={1}
                    label={t("products.form.amount")}
                    value={form.stock}
                    onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                />
            )}
            {showMasterLink ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                            id={`${idPrefix}-lief`}
                            label={t("common.supplier")}
                            value={form.supplierId}
                            onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                            options={supplierOptions}
                            disabled={suppliers.length === 0}
                        />
                        <Select
                            id={`${idPrefix}-contact`}
                            label={t("page.orderMaster.contact_label")}
                            value={form.pharmaConsultantId}
                            onChange={(e) => setForm((p) => ({ ...p, pharmaConsultantId: e.target.value }))}
                            options={contactOptions}
                            disabled={pharma_consultant.length === 0}
                        />
                    </div>
                    {suppliers.length === 0 || pharma_consultant.length === 0 ? (
                        <p className="ui-field-hint" style={{ marginTop: -4 }}>
                            {t("products.form.master_empty_hint")}
                        </p>
                    ) : null}
                </>
            ) : null}
            <Textarea
                id={`${idPrefix}-beschr`}
                label={t("common.description")}
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
        </>
    );
}
