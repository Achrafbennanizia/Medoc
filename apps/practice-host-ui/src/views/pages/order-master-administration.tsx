import { useCallback, useEffect, useMemo, useState } from "react";
import { listProducts, createProduct } from "@/systems/practice-host/controllers/product.controller";
import {
    listSupplierMaster,
    createSupplierMaster,
    deleteSupplierMaster,
    listPharmaConsultantMaster,
    createPharmaConsultantMaster,
    deletePharmaConsultantMaster,
    listSupplierPharmaTemplates,
    createSupplierPharmaTemplate,
    deleteSupplierPharmaTemplate,
} from "@/systems/practice-host/controllers/practice.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { SupplierPharmaTemplate, SupplierMaster, PharmaConsultantMaster, Product } from "@/models/types";
import { countProductsWithName, errorMessage, productSelectLabel } from "@/lib/utils";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { TrashIcon } from "@/lib/icons";
import { ProductFormFields } from "../components/product-form-shared";
import { emptyForm, formValid, hasMasterLinkSelection, parseForm, type ProductForm } from "@/lib/product-form-model";
import { PRODUCT_STOCK_UI_ENABLED } from "@/lib/catalog-menu-flags";

/**
 * Administration: master data for orders — suppliers, PharmaConsultant/contacts
 * and saved combinations for "Neue PurchaseOrder".
 */
export function OrderMasterAdministrationPage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWrite = role ? allowed("purchase_order.write", role) : false;
    const canProductWrite = role ? allowed("product.write", role) : false;
    const stockFormOpts = { stockUi: PRODUCT_STOCK_UI_ENABLED } as const;

    const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
    const [kontakte, setKontakte] = useState<PharmaConsultantMaster[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [templates, setTemplates] = useState<SupplierPharmaTemplate[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);

    const [newLief, setNewLief] = useState("");
    const [newContact, setNewContact] = useState("");
    const [comboLiefId, setComboLiefId] = useState("");
    const [comboContactId, setComboContactId] = useState("");
    const [comboProductId, setComboProductId] = useState("");

    const [creatingProduct, setCreatingProduct] = useState(false);
    const [productCreateForm, setProductCreateForm] = useState<ProductForm>(emptyForm());
    const [productCreateBusy, setProductCreateBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [deleteKind, setDeleteKind] = useState<"lief" | "contact" | "template" | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const reload = useCallback(async (opts?: { selectProductId?: string }) => {
        setLoadError(null);
        setStatus("loading");
        try {
            const [l, k, version, prods] = await Promise.all([
                listSupplierMaster(),
                listPharmaConsultantMaster(),
                listSupplierPharmaTemplates(),
                listProducts(),
            ]);
            setSuppliers(l);
            setKontakte(k);
            setProducts(prods);
            setTemplates(version);
            setComboLiefId((prev) => (prev && l.some((x) => x.id === prev) ? prev : l[0]?.id ?? ""));
            setComboContactId((prev) => (prev && k.some((x) => x.id === prev) ? prev : k[0]?.id ?? ""));
            setComboProductId((prev) => {
                const prefer = opts?.selectProductId;
                if (prefer && prods.some((x) => x.id === prefer)) return prefer;
                if (prev && prods.some((x) => x.id === prev)) return prev;
                return prods[0]?.id ?? "";
            });
            setStatus("ready");
        } catch (e) {
            setLoadError(errorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const supplierOptions = useMemo(
        () => suppliers.map((x) => ({ value: x.id, label: x.name })),
        [suppliers],
    );
    const contactOptions = useMemo(
        () => kontakte.map((x) => ({ value: x.id, label: x.name })),
        [kontakte],
    );

    const productsSorted = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [products],
    );
    const productOptions = useMemo(
        () =>
            productsSorted.map((p) => ({
                value: p.id,
                label: productSelectLabel(p, countProductsWithName(products, p.name)),
            })),
        [products, productsSorted],
    );

    const categorySuggestions = useMemo(() => {
        const s = new Set<string>();
        for (const p of products) {
            const k = p.category?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, sortLocale));
    }, [products]);

    const addSupplier = async () => {
        if (!canWrite || !newLief.trim()) {
            toast(t("page.orderMaster.toast.name_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await createSupplierMaster({ name: newLief.trim() });
            toast(t("page.orderMaster.toast.supplier_saved"));
            setNewLief("");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const addContact = async () => {
        if (!canWrite || !newContact.trim()) {
            toast(t("page.orderMaster.toast.name_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await createPharmaConsultantMaster({ name: newContact.trim() });
            toast(t("page.orderMaster.toast.contact_saved"));
            setNewContact("");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const cancelCreateProduct = () => {
        setCreatingProduct(false);
        setProductCreateForm(emptyForm());
    };

    const handleCreateProduct = async () => {
        if (!formValid(productCreateForm, stockFormOpts) || !canProductWrite) return;
        setProductCreateBusy(true);
        try {
            const payload = parseForm(productCreateForm, stockFormOpts);
            const created = await createProduct(payload);
            if (canWrite && hasMasterLinkSelection(productCreateForm)) {
                await createSupplierPharmaTemplate({
                    supplier_id: productCreateForm.supplierId,
                    pharma_consultant_id: productCreateForm.pharmaConsultantId,
                    product_id: created.id,
                });
            }
            toast(t("page.orderMaster.toast.product_created"), "success");
            setProductCreateForm(emptyForm());
            setCreatingProduct(false);
            await reload({ selectProductId: created.id });
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setProductCreateBusy(false);
        }
    };

    const addTemplate = async () => {
        if (!canWrite || !comboLiefId || !comboContactId || !comboProductId) {
            toast(t("page.orderMaster.toast.combo_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await createSupplierPharmaTemplate({
                supplier_id: comboLiefId,
                pharma_consultant_id: comboContactId,
                product_id: comboProductId,
            });
            toast(t("page.orderMaster.toast.combo_saved"));
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId || !deleteKind || !canWrite) return;
        setBusy(true);
        try {
            if (deleteKind === "lief") await deleteSupplierMaster(deleteId);
            else if (deleteKind === "contact") await deletePharmaConsultantMaster(deleteId);
            else await deleteSupplierPharmaTemplate(deleteId);
            toast(t("page.orderMaster.toast.removed"));
            setDeleteId(null);
            setDeleteKind(null);
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const selectPlaceholder = t("page.orderMaster.select_placeholder");

    if (status === "loading") return <PageLoading label={t("page.orderMaster.loading")} />;
    if (status === "error" && loadError) {
        return (
            <div className="practice-workspace-page animate-fade-in--sticky-safe">
                <AdministrationPageHeader title={t("page.orderMaster.title")} />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    return (
        <div className="practice-workspace-page animate-fade-in--sticky-safe">
            <AdministrationPageHeader
                titleLevel="h1"
                title={t("page.orderMaster.title")}
                subtitle={t("page.orderMaster.subtitle")}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card card-pad">
                    <h2 className="text-title" style={{ margin: "0 0 12px" }}>{t("page.orderMaster.suppliers")}</h2>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <Input
                                id="bs-lief-new"
                                label={t("page.orderMaster.new_supplier")}
                                value={newLief}
                                onChange={(e) => setNewLief(e.target.value)}
                                disabled={!canWrite}
                                placeholder={t("page.orderMaster.supplier_ph")}
                            />
                        </div>
                        <Button type="button" style={{ alignSelf: "flex-end" }} onClick={() => void addSupplier()} disabled={!canWrite || busy}>
                            {t("common.add")}
                        </Button>
                    </div>
                    {suppliers.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.orderMaster.empty_entries")}</p>
                    ) : (
                        <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--fg-2)" }}>
                            {suppliers.map((r) => (
                                <li key={r.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>{r.name}</span>
                                    {canWrite ? (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDeleteKind("lief"); setDeleteId(r.id); }} aria-label={t("common.remove")}>
                                            <TrashIcon size={14} />
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="card card-pad">
                    <h2 className="text-title" style={{ margin: "0 0 12px" }}>{t("page.orderMaster.contacts")}</h2>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <Input
                                id="bs-contact-new"
                                label={t("page.orderMaster.new_contact")}
                                value={newContact}
                                onChange={(e) => setNewContact(e.target.value)}
                                disabled={!canWrite}
                                placeholder={t("page.orderMaster.contact_ph")}
                            />
                        </div>
                        <Button type="button" style={{ alignSelf: "flex-end" }} onClick={() => void addContact()} disabled={!canWrite || busy}>
                            {t("common.add")}
                        </Button>
                    </div>
                    {kontakte.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.orderMaster.empty_entries")}</p>
                    ) : (
                        <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--fg-2)" }}>
                            {kontakte.map((r) => (
                                <li key={r.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>{r.name}</span>
                                    {canWrite ? (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDeleteKind("contact"); setDeleteId(r.id); }} aria-label={t("common.remove")}>
                                            <TrashIcon size={14} />
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {canProductWrite ? (
                <Card>
                    <CardHeader
                        title={t("page.orderMaster.product_new_title")}
                        subtitle={t("page.orderMaster.product_new_subtitle")}
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant={creatingProduct ? "secondary" : "ghost"}
                                onClick={
                                    creatingProduct
                                        ? cancelCreateProduct
                                        : () => {
                                              setCreatingProduct(true);
                                              setProductCreateForm(emptyForm());
                                          }
                                }
                            >
                                {creatingProduct ? t("page.orderMaster.product_cancel") : t("page.orderMaster.product_new_btn")}
                            </Button>
                        }
                    />
                    {creatingProduct ? (
                        <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                            <ProductFormFields
                                form={productCreateForm}
                                setForm={setProductCreateForm}
                                idPrefix="bs-prod-new"
                                categorySuggestions={categorySuggestions}
                                showMasterLink
                                suppliers={suppliers}
                                pharma_consultant={kontakte}
                            />
                            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" variant="ghost" onClick={cancelCreateProduct} disabled={productCreateBusy}>
                                    {t("page.orderMaster.product_cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handleCreateProduct()}
                                    disabled={!formValid(productCreateForm, stockFormOpts) || productCreateBusy}
                                    loading={productCreateBusy}
                                >
                                    {t("common.create")}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </Card>
            ) : null}

            <div className="card card-pad">
                <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>
                    {t("page.orderMaster.combo_hint")}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-end" }}>
                    <Select
                        id="bs-combo-l"
                        label={t("common.supplier")}
                        value={comboLiefId}
                        onChange={(e) => setComboLiefId(e.target.value)}
                        options={[{ value: "", label: selectPlaceholder }, ...supplierOptions]}
                        disabled={!canWrite || supplierOptions.length === 0}
                    />
                    <Select
                        id="bs-combo-p"
                        label={t("page.orderMaster.contact_label")}
                        value={comboContactId}
                        onChange={(e) => setComboContactId(e.target.value)}
                        options={[{ value: "", label: selectPlaceholder }, ...contactOptions]}
                        disabled={!canWrite || contactOptions.length === 0}
                    />
                </div>
                <div style={{ marginTop: 12, maxWidth: 560 }}>
                    <Select
                        id="bs-combo-prod"
                        label={t("page.orderMaster.product_label")}
                        value={comboProductId}
                        onChange={(e) => setComboProductId(e.target.value)}
                        options={[{ value: "", label: selectPlaceholder }, ...productOptions]}
                        disabled={!canWrite || productOptions.length === 0}
                    />
                </div>
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                    <Button
                        type="button"
                        onClick={() => void addTemplate()}
                        disabled={!canWrite || busy || !comboLiefId || !comboContactId || !comboProductId}
                    >
                        {t("page.orderMaster.save_combo")}
                    </Button>
                </div>

                {templates.length > 0 ? (
                    <div style={{ overflowX: "auto", marginTop: 16 }} className="tbl-scroll">
                        <table className="tbl tbl-fluid">
                            <thead>
                                <tr>
                                    <th>{t("common.supplier")}</th>
                                    <th>{t("page.orderMaster.col.contact")}</th>
                                    <th>{t("page.orderMaster.col.product")}</th>
                                    <th style={{ width: 100 }}>{t("page.orderMaster.col.action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map((version) => (
                                    <tr key={version.id}>
                                        <td>{version.supplier_name}</td>
                                        <td>{version.pharma_consultant_name}</td>
                                        <td>
                                            {version.product_active === 0 ? (
                                                <span style={{ color: "var(--fg-3)" }} title={t("page.orderMaster.product_inactive_title")}>
                                                    {tp("page.orderMaster.product_inactive", { name: version.product_name })}
                                                </span>
                                            ) : (
                                                <span>
                                                    {version.product_name} · {version.product_category}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {canWrite ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setDeleteKind("template"); setDeleteId(version.id); }}
                                                >
                                                    <TrashIcon size={14} /> {t("common.remove")}
                                                </Button>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: "var(--fg-3)", fontSize: 13, marginBottom: 0 }}>{t("page.orderMaster.no_combos")}</p>
                )}
            </div>

            {!canWrite ? (
                <p style={{ fontSize: 13, color: "var(--fg-3)" }}>{t("page.orderMaster.read_only_hint")}</p>
            ) : null}

            <ConfirmDialog
                open={!!deleteId && !!deleteKind}
                onClose={() => {
                    if (busy) return;
                    setDeleteId(null);
                    setDeleteKind(null);
                }}
                onConfirm={() => void confirmDelete()}
                title={t("page.orderMaster.delete.title")}
                message={t("page.orderMaster.delete.message")}
                confirmLabel={t("page.orderMaster.delete.confirm")}
                danger
                loading={busy}
            />
        </div>
    );
}
