import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProducts, createProduct, deleteProduct, updateProduct } from "@/systems/practice-host/controllers/product.controller";
import {
    createSupplierPharmaTemplate,
    listSupplierMaster,
    listPharmaConsultantMaster,
} from "@/systems/practice-host/controllers/practice.controller";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { SupplierMaster, PharmaConsultantMaster, Product } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon } from "@/lib/icons";
import { ProductFormFields } from "../components/product-form-shared";
import { emptyForm, formValid, hasMasterLinkSelection, parseForm, toForm, type ProductForm } from "@/lib/product-form-model";
import {
    appendProductIdToReturnUrl,
    emptyPurchaseOrderCreateDraft,
    isPurchaseOrderCreateReturnPath,
    readPurchaseOrderCreateDraft,
    savePurchaseOrderCreateDraft,
} from "@/lib/purchase-order-product-bridge";
import { PRODUCT_STOCK_UI_ENABLED } from "@/lib/catalog-menu-flags";

function isSafeInternalReturnPath(path: string | null): path is string {
    if (path == null || path.length === 0 || path.length > 4000) return false;
    if (!path.startsWith("/")) return false;
    if (path.startsWith("//") || path.includes("://")) return false;
    return true;
}

export function ProductsPage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [pharma_consultant, setPharmaConsultant] = useState<PharmaConsultantMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    /** New product — page panel only */
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<ProductForm>(emptyForm());
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Product | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState<ProductForm>(emptyForm());
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWrite = role != null && allowed("product.write", role);
    const canLinkMaster = role != null && allowed("purchase_order.write", role);
    const canGoAdministration = role != null && allowed("administration.read", role);
    const stockFormOpts = { stockUi: PRODUCT_STOCK_UI_ENABLED } as const;

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const [data, lief, ph] = await Promise.all([
                    listProducts(),
                    listSupplierMaster(),
                    listPharmaConsultantMaster(),
                ]);
                setProducts(data);
                setSuppliers(lief);
                setPharmaConsultant(ph);
                setSelected((cur) => {
                    if (!cur) return null;
                    const up = data.find((x) => x.id === cur.id);
                    return up ?? null;
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (isInitial) setLoadError(msg);
                else toast(tp("common.refresh_failed", { message: msg }), "error");
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        [toast, tp],
    );

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const newFromQuery = searchParams.get("new");
    const returnToPath = searchParams.get("returnTo");
    useEffect(() => {
        if (newFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        const draft = isPurchaseOrderCreateReturnPath(returnToPath) ? readPurchaseOrderCreateDraft() : null;
        if (draft) {
            setCreateForm({
                ...emptyForm(),
                supplierId: draft.supplierId,
                pharmaConsultantId: draft.pharmaConsultantId,
                stock: draft.quantity.trim() || "",
            });
        } else {
            setCreateForm(emptyForm());
        }
        setDetailEdit(false);
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("new");
                return n;
            },
            { replace: true },
        );
    }, [newFromQuery, canWrite, returnToPath, setSearchParams]);

    const openCreate = () => {
        setCreating(true);
        setSelected(null);
        setCreateForm(emptyForm());
        setDetailEdit(false);
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm(emptyForm());
    };

    const selectRow = (p: Product) => {
        setCreating(false);
        setSelected(p);
        setEditForm(toForm(p));
        setDetailEdit(false);
    };

    const handleCreate = async () => {
        if (!formValid(createForm, stockFormOpts) || !canWrite) return;
        setCreateBusy(true);
        try {
            const p = parseForm(createForm, stockFormOpts);
            const created = await createProduct(p);
            if (canLinkMaster && hasMasterLinkSelection(createForm)) {
                await createSupplierPharmaTemplate({
                    supplier_id: createForm.supplierId,
                    pharma_consultant_id: createForm.pharmaConsultantId,
                    product_id: created.id,
                });
            }
            toast(t("products.toast.created"), "success");
            setCreateForm(emptyForm());
            setCreating(false);
            const returnTo = searchParams.get("returnTo");
            if (isSafeInternalReturnPath(returnTo)) {
                if (isPurchaseOrderCreateReturnPath(returnTo)) {
                    const draft = readPurchaseOrderCreateDraft();
                    savePurchaseOrderCreateDraft({
                        ...(draft ?? emptyPurchaseOrderCreateDraft()),
                        supplierId: createForm.supplierId || draft?.supplierId || "",
                        pharmaConsultantId: createForm.pharmaConsultantId || draft?.pharmaConsultantId || "",
                        quantity: createForm.stock.trim() || draft?.quantity || "1",
                        itemProductId: created.id,
                    });
                }
                navigate(appendProductIdToReturnUrl(returnTo, created.id), { replace: true });
            } else {
                setSelected(created);
                setEditForm(toForm(created));
                setDetailEdit(false);
                void load();
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setCreateBusy(false);
        }
    };

    const handleUpdate = async () => {
        if (!selected || !formValid(editForm, stockFormOpts) || !canWrite) return;
        setSaveBusy(true);
        try {
            const p = parseForm(editForm, {
                ...stockFormOpts,
                stockFallback: { stock: selected.stock, min_stock: selected.min_stock },
            });
            const updated = await updateProduct(selected.id, {
                name: p.name,
                category: p.category,
                price: p.price,
                stock: p.stock,
                min_stock: p.min_stock,
                description: p.description ?? null,
            });
            setProducts((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            setSelected(updated);
            setDetailEdit(false);
            toast(t("products.toast.saved"), "success");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setSaveBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;
        try {
            await deleteProduct(id);
            toast(t("products.toast.deleted"), "success");
            setDeleteId(null);
            setSelected((s) => (s?.id === id ? null : s));
            setDetailEdit(false);
            void load();
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    };

    const cancelEdit = () => {
        if (selected) setEditForm(toForm(selected));
        setDetailEdit(false);
    };

    const productsSorted = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [products],
    );

    /** Distinct categories from inventory — as suggestions for input + selection (datalist). */
    const categorySuggestions = useMemo(() => {
        const s = new Set<string>();
        for (const p of products) {
            const k = p.category?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, sortLocale));
    }, [products]);

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value === null || value === undefined || value === "" ? t("common.em_dash") : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="products-detail-card card--overflow-visible">
                    <CardHeader
                        title={t("products.create.title")}
                        subtitle={t("products.create.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <ProductFormFields
                            form={createForm}
                            setForm={setCreateForm}
                            idPrefix="prod-new"
                            categorySuggestions={categorySuggestions}
                            showMasterLink
                            suppliers={suppliers}
                            pharma_consultant={pharma_consultant}
                        />
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} disabled={!formValid(createForm, stockFormOpts) || createBusy} loading={createBusy}>
                                {t("common.create")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={selected.name}
                        subtitle={detailEdit ? t("products.detail.edit_sub") : t("products.detail.read_sub")}
                        action={canWrite && !detailEdit ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={() => { setDetailEdit(true); setEditForm(toForm(selected)); }}>
                                    <EditIcon size={14} />
                                    {" "}
                                    {t("common.edit")}
                                </Button>
                                <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(selected.id)}>
                                    {t("common.delete")}
                                </Button>
                            </div>
                        ) : null}
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        {detailEdit && canWrite ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <ProductFormFields form={editForm} setForm={setEditForm} idPrefix="prod-edit" categorySuggestions={categorySuggestions} />
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                    <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                        {t("common.cancel")}
                                    </Button>
                                    <Button type="button" onClick={() => void handleUpdate()} disabled={!formValid(editForm, stockFormOpts) || saveBusy} loading={saveBusy}>
                                        {t("common.save")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="products-read-grid">
                                {readField(t("common.name"), selected.name)}
                                {readField(t("common.category"), selected.category)}
                                {readField(t("common.price_eur"), formatCurrency(selected.price))}
                                {PRODUCT_STOCK_UI_ENABLED ? readField(t("common.stock"), selected.stock) : readField(t("products.form.amount"), selected.stock)}
                                {PRODUCT_STOCK_UI_ENABLED ? readField(t("common.min_stock"), selected.min_stock) : null}
                                {readField(t("common.status"), selected.active ? t("common.active") : t("common.inactive"))}
                                <div style={{ gridColumn: "1 / -1" }}>{readField(t("common.description"), selected.description ?? t("common.em_dash"))}</div>
                                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--fg-3)" }}>
                                    {tp("common.last_modified", { date: formatDateTime(selected.updated_at) })}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad products-detail-card products-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("products.panel_empty_write")
                        : t("products.panel_empty_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="products-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                showBack={canGoAdministration}
                title={t("products.page.title")}
                subtitle={t("products.page.subtitle")}
                actions={
                    canWrite ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("products.cancel_create_btn") : t("products.new_btn")}
                        </Button>
                    ) : null
                }
            />

            {loading ? (
                <PageLoading label={t("products.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="products-workspace">
                    <div className="products-workspace__list">
                        {products.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="📦"
                                    title={t("products.empty")}
                                    description={canWrite ? t("products.empty_create_hint") : t("products.empty_stock")}
                                />
                            </Card>
                        ) : (
                            <div className="card products-table-card tbl-data-card tbl-scroll">
                                <table className="tbl products-tbl">
                                    <thead>
                                        <tr>
                                            <th scope="col">{t("common.name")}</th>
                                            <th scope="col">{t("common.category")}</th>
                                            <th scope="col" style={{ textAlign: "end" }}>{t("common.price")}</th>
                                            {PRODUCT_STOCK_UI_ENABLED ? (
                                                <th scope="col" style={{ textAlign: "end" }}>{t("common.stock")}</th>
                                            ) : null}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productsSorted.map((p) => {
                                            const isSel = !creating && selected?.id === p.id;
                                            const pick = () => selectRow(p);
                                            const onRowKeyDown = (e: KeyboardEvent) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    pick();
                                                }
                                            };
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={isSel ? "products-row--selected" : undefined}
                                                    tabIndex={0}
                                                    onClick={() => pick()}
                                                    onKeyDown={onRowKeyDown}
                                                    style={{ cursor: "pointer" }}
                                                    aria-label={tp("common.row_show_aria", { entity: t("products.entity"), name: p.name })}
                                                >
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{p.name}</span>
                                                        {!p.active ? (
                                                            <span style={{ marginInlineStart: 8, display: "inline-block" }}>
                                                                <Badge variant="warning">{t("common.inactive")}</Badge>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{p.category}</td>
                                                    <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.price)}</td>
                                                    {PRODUCT_STOCK_UI_ENABLED ? (
                                                        <td style={{ textAlign: "end" }}>
                                                            {p.stock <= p.min_stock ? (
                                                                <Badge variant="error">
                                                                    {tp("common.stock_low", { stock: p.stock, min: p.min_stock })}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-on-surface" style={{ fontVariantNumeric: "tabular-nums" }}>{p.stock}</span>
                                                            )}
                                                        </td>
                                                    ) : null}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="products-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("products.delete_title")}
                message={t("products.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}
