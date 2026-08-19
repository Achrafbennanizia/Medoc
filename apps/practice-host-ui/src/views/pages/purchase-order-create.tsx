import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createPurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import { listProducts } from "@/systems/practice-host/controllers/product.controller";
import {
    listSupplierMaster,
    listPharmaConsultantMaster,
    listSupplierPharmaTemplates,
} from "@/systems/practice-host/controllers/practice.controller";
import {
    clearPurchaseOrderCreateDraft,
    emptyPurchaseOrderCreateDraft,
    readPurchaseOrderCreateDraft,
    savePurchaseOrderCreateDraft,
    type PurchaseOrderCreateDraft,
} from "@/lib/purchase-order-product-bridge";
import { countProductsWithName, errorMessage, formatCurrency, productSelectLabel } from "@/lib/utils";
import { roundMoney2 } from "@/lib/payment-booking";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { SupplierPharmaTemplate, SupplierMaster, PharmaConsultantMaster, Product } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";

/** Display text for quick-select template (supplier · contact · product). */
function formatTemplateDatalistLine(
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

function buildTemplatesDatalistRows(
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

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function validateForm(f: PurchaseOrderCreateDraft, anzahlProducts: number, t: (key: string) => string): string | null {
    const quantity = Number(f.quantity);
    if (!f.supplierId.trim()) return t("page.purchase_order.create.validation.supplier_required");
    if (anzahlProducts < 1) return t("page.purchase_order.create.validation.products_required");
    if (!f.itemProductId.trim()) return t("page.purchase_order.create.validation.article_required");
    if (!Number.isFinite(quantity) || quantity <= 0) return t("page.purchase_order.create.validation.quantity_positive");
    if (f.expected_on && f.expected_on < todayISO()) return t("page.purchase_order.create.validation.date_past");
    return null;
}

function masterName(list: { id: string; name: string }[], id: string): string {
    return list.find((x) => x.id === id)?.name.trim() ?? "";
}

export function PurchaseOrderCreatePage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const from = searchParams.get("from");
    const productIdFromReturn = searchParams.get("productId");
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canAddProduct = role != null && allowed("product.write", role);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliersMaster, setSuppliersMaster] = useState<SupplierMaster[]>([]);
    const [pharmaConsultantMaster, setPharmaConsultantMaster] = useState<PharmaConsultantMaster[]>([]);
    const [templates, setTemplates] = useState<SupplierPharmaTemplate[]>([]);
    const templateDatalistDomId = useId();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<PurchaseOrderCreateDraft>(emptyPurchaseOrderCreateDraft);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [lief, ph, vor, prods] = await Promise.all([
                listSupplierMaster(),
                listPharmaConsultantMaster(),
                listSupplierPharmaTemplates(),
                listProducts(),
            ]);
            setProducts(prods);
            setSuppliersMaster(lief);
            setPharmaConsultantMaster(ph);
            setTemplates(vor);
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    /** Restore draft after returning from New product. */
    useEffect(() => {
        if (!productIdFromReturn) return;
        const draft = readPurchaseOrderCreateDraft();
        const next: PurchaseOrderCreateDraft = {
            ...(draft ?? emptyPurchaseOrderCreateDraft()),
            itemProductId: productIdFromReturn,
        };
        setForm(next);
        clearPurchaseOrderCreateDraft();
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("productId");
                return n;
            },
            { replace: true },
        );
    }, [productIdFromReturn, setSearchParams]);

    const masterPlaceholder = t("page.orderMaster.select_placeholder");
    const supplierOptions = useMemo(
        () => [
            { value: "", label: masterPlaceholder },
            ...suppliersMaster.map((x) => ({ value: x.id, label: x.name })),
        ],
        [suppliersMaster, masterPlaceholder],
    );
    const pharmaOptions = useMemo(
        () => [
            { value: "", label: masterPlaceholder },
            ...pharmaConsultantMaster.map((x) => ({ value: x.id, label: x.name })),
        ],
        [pharmaConsultantMaster, masterPlaceholder],
    );

    const productsSorted = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [products, sortLocale],
    );

    const itemProductOptions = useMemo(
        () => [
            { value: "", label: t("page.purchase_order.create.product_select_ph") },
            ...productsSorted.map((p) => ({
                value: p.id,
                label: productSelectLabel(p, countProductsWithName(products, p.name)),
            })),
        ],
        [products, productsSorted, t],
    );

    const templatesDatalistRows = useMemo(() => buildTemplatesDatalistRows(templates, tp), [templates, tp]);
    const templateByDatalistLabel = useMemo(
        () => new Map(templatesDatalistRows.map((r) => [r.label, r.version] as const)),
        [templatesDatalistRows],
    );

    const voraussichtTotalAmount = useMemo(() => {
        const p = products.find((x) => x.id === form.itemProductId);
        const m = Number(String(form.quantity).replace(",", "."));
        if (!p || !Number.isFinite(m) || m <= 0) return null;
        return roundMoney2(p.price * m);
    }, [products, form.itemProductId, form.quantity]);

    function goNeuesProduct() {
        savePurchaseOrderCreateDraft(form);
        const returnTo = `${location.pathname}${location.search}`;
        const params = new URLSearchParams();
        params.set("new", "1");
        params.set("returnTo", returnTo);
        navigate(`/products?${params.toString()}`);
    }

    function goBack() {
        clearPurchaseOrderCreateDraft();
        if (from === "finance") navigate("/finance");
        else navigate("/purchase-orders");
    }

    async function handleCreate() {
        const err = validateForm(form, products.length, t);
        if (err) {
            setError(err);
            return;
        }
        const product = products.find((p) => p.id === form.itemProductId);
        if (!product) {
            setError(t("page.purchase_order.create.invalid_product"));
            return;
        }
        const supplierName = masterName(suppliersMaster, form.supplierId);
        if (!supplierName) {
            setError(t("page.purchase_order.create.validation.supplier_required"));
            return;
        }
        const quantityN = Number(String(form.quantity).replace(",", "."));
        const total_amount =
            Number.isFinite(quantityN) && quantityN > 0 ? roundMoney2(product.price * quantityN) : null;
        const pharmaConsultantName = masterName(pharmaConsultantMaster, form.pharmaConsultantId);
        setBusy(true);
        setError(null);
        try {
            const created = await createPurchaseOrder({
                supplier: supplierName,
                item: product.name,
                quantity: quantityN,
                unit: form.unit.trim() || null,
                expected_on: form.expected_on || null,
                remark: form.remark.trim() || null,
                pharma_consultant: pharmaConsultantName || null,
                ...(total_amount != null ? { total_amount: total_amount } : {}),
            });
            clearPurchaseOrderCreateDraft();
            toast(tp("page.purchase_order.create.created_toast", { nummer: created.order_number ?? "" }), "success");
            navigate(`/purchase-orders?purchase_order=${encodeURIComponent(created.id)}`);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <PageLoading label={t("page.purchase-orders.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    const validationError = validateForm(form, products.length, t);
    const cannotSave = validationError !== null || busy;
    const masterEmpty = suppliersMaster.length === 0 || pharmaConsultantMaster.length === 0;

    return (
        <div className="purchase-order-create-page practice-workspace-page practice-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.purchase_order.create.title")}
                back={{ onClick: goBack, label: t("page.purchase-orders.title") }}
            />

            <Card className="purchase-order-create-page__card card-elevated card--overflow-visible">
                <CardHeader title={t("page.purchase_order.create.card_title")} subtitle={t("page.purchase_order.create.card_sub")} />
                <div className="card-pad purchase-order-create-form">
                    {error ? (
                        <p className="purchase-order-create-form__error">{error}</p>
                    ) : null}
                    <p className="purchase-order-create-form__hint">
                        {t("page.purchase_order.create.order_number_hint")}
                    </p>
                    {templates.length > 0 ? (
                        <div className="purchase-order-create-form__field">
                            <Input
                                id="bc-template"
                                label={t("page.purchase_order.create.template_label")}
                                list={templateDatalistDomId}
                                value={form.templateInputText}
                                autoComplete="off"
                                placeholder={t("page.purchase_order.create.search_ph")}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const version = templateByDatalistLabel.get(val.trim());
                                    if (version) {
                                        const p = products.find((x) => x.id === version.product_id);
                                        setForm((f) => ({
                                            ...f,
                                            templateInputText: val,
                                            supplierId: version.supplier_id,
                                            pharmaConsultantId: version.pharma_consultant_id,
                                            itemProductId: p ? version.product_id : "",
                                        }));
                                        if (version.product_id && !p) {
                                            toast(
                                                t("page.purchase_order.create.template_inactive_toast"),
                                                "error",
                                            );
                                        }
                                    } else {
                                        setForm((f) => ({ ...f, templateInputText: val }));
                                    }
                                }}
                            />
                            <datalist id={templateDatalistDomId}>
                                {templatesDatalistRows.map(({ version, label }) => (
                                    <option key={version.id} value={label} />
                                ))}
                            </datalist>
                        </div>
                    ) : null}
                    <div className="purchase-order-create-form__grid purchase-order-create-form__grid--2">
                        <Select
                            id="bc-lief"
                            label={t("common.supplier")}
                            value={form.supplierId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    templateInputText: "",
                                    supplierId: e.target.value,
                                }));
                            }}
                            options={supplierOptions}
                            disabled={suppliersMaster.length === 0}
                        />
                        <Select
                            id="bc-pharma"
                            label={t("page.purchase_order.create.pharma_contact")}
                            value={form.pharmaConsultantId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    templateInputText: "",
                                    pharmaConsultantId: e.target.value,
                                }));
                            }}
                            options={pharmaOptions}
                            disabled={pharmaConsultantMaster.length === 0}
                        />
                    </div>
                    {masterEmpty ? (
                        <p className="purchase-order-create-form__note">{t("products.form.master_empty_hint")}</p>
                    ) : null}
                    <div className="purchase-order-create-form__field purchase-order-create-form_item-row">
                        <Select
                            id="bc-kind"
                            label={t("page.purchase_order.create.article_label")}
                            value={form.itemProductId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    templateInputText: "",
                                    itemProductId: e.target.value,
                                }));
                            }}
                            options={itemProductOptions}
                        />
                        {canAddProduct ? (
                            <Button
                                type="button"
                                variant="secondary"
                                title={t("page.purchase_order.create.new_product_title")}
                                onClick={goNeuesProduct}
                            >
                                {t("page.purchase_order.create.new_product_btn")}
                            </Button>
                        ) : null}
                    </div>
                    {products.length === 0 ? (
                        <p className="purchase-order-create-form__note">
                            {t("page.purchase_order.create.no_products_note")}
                        </p>
                    ) : null}
                    <div className="purchase-order-create-form__grid purchase-order-create-form__grid--2">
                        <Input
                            id="bc-quantity"
                            label={t("common.quantity")}
                            type="number"
                            min={1}
                            value={form.quantity}
                            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                        />
                        <Input
                            id="bc-unit"
                            label={t("common.unit")}
                            placeholder={t("page.purchase_order.create.unit_ph")}
                            value={form.unit}
                            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                        />
                    </div>
                    {voraussichtTotalAmount != null ? (
                        <div className="purchase-order-create-form_amount">
                            <div className="form-label form-label--wide">{t("page.purchase_order.create.amount_label")}</div>
                            <div className="purchase-order-create-form_amount-value">
                                {formatCurrency(voraussichtTotalAmount)}
                            </div>
                            <p className="purchase-order-create-form__note">
                                {t("page.purchase_order.create.amount_note")}
                            </p>
                        </div>
                    ) : null}
                    <Input
                        id="bc-erw"
                        label={t("common.expected_on")}
                        type="date"
                        min={todayISO()}
                        value={form.expected_on}
                        onChange={(e) => setForm((f) => ({ ...f, expected_on: e.target.value }))}
                    />
                    <Textarea
                        id="bc-bem"
                        label={t("common.note")}
                        rows={3}
                        value={form.remark}
                        onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                    />
                    <div className="purchase-order-create-form__actions">
                        <Button type="button" variant="ghost" onClick={goBack} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" onClick={() => void handleCreate()} loading={busy} disabled={cannotSave}>
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
