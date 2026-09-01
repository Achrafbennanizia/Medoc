import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Product } from "@/models/types";
import {
    deletePurchaseOrder,
    updatePurchaseOrder,
    updatePurchaseOrderStatus,
    type PurchaseOrder,
    type OrderStatus,
} from "@/systems/practice-host/controllers/purchase-order.controller";
import { listProducts } from "@/systems/practice-host/controllers/product.controller";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { orderStatusDisplay, orderStatusOptions } from "@/lib/finance-order-labels";
import { useDateFnsLocale, useLocale, useT, useTParams } from "@/lib/i18n";
import { EditIcon, XIcon } from "@/lib/icons";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { Input, Select, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: PurchaseOrder): boolean {
    if (!b.expected_on) return false;
    if (b.status === "DELIVERED" || b.status === "CANCELLED") return false;
    return b.expected_on < todayISO();
}

function statusPill(status: OrderStatus, overdue: boolean, t: (key: string) => string): { className: string; label: string } {
    if (overdue) return { className: "pill orange", label: t("page.purchase_orders.status.overdue") };
    const st = orderStatusDisplay(status, t);
    switch (status) {
        case "OPEN":
            return { className: "pill grey", label: st.label };
        case "IN_TRANSIT":
            return { className: "pill blue", label: st.label };
        case "DELIVERED":
            return { className: "pill green", label: st.label };
        case "CANCELLED":
            return { className: "pill grey", label: st.label };
    }
}

interface EditDraft {
    supplier: string;
    pharma_consultant: string;
    item: string;
    quantity: string;
    unit: string;
    expected_on: string;
    remark: string;
}

function draftFromPurchaseOrder(b: PurchaseOrder): EditDraft {
    return {
        supplier: b.supplier,
        pharma_consultant: b.pharma_consultant ?? "",
        item: b.item,
        quantity: String(b.quantity),
        unit: b.unit ?? "",
        expected_on: b.expected_on ?? "",
        remark: b.remark ?? "",
    };
}

export type PurchaseOrderDetailDrawerProps = {
    purchase_order: PurchaseOrder;
    canWrite: boolean;
    canAddProduct: boolean;
    onClose: () => void;
    onUpdated: (b: PurchaseOrder) => void;
    onDeleted: (id: string) => void;
};

export function PurchaseOrderDetailDrawer({
    purchase_order,
    canWrite,
    canAddProduct,
    onClose,
    onUpdated,
    onDeleted,
}: PurchaseOrderDetailDrawerProps) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<EditDraft | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [statusBusy, setStatusBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);

    const statusOptions = useMemo(() => orderStatusOptions(t), [t]);
    const overdue = useMemo(() => isOverdue(purchase_order), [purchase_order]);
    const pill = statusPill(purchase_order.status, overdue, t);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".appointment-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    useEffect(() => {
        setEditing(false);
        setDraft(null);
        setSaveError(null);
    }, [purchase_order.id]);

    const loadProducts = useCallback(async () => {
        try {
            const list = await listProducts();
            setProducts(list);
        } catch {
            setProducts([]);
        }
    }, []);

    const productsSorted = useMemo(
        () => [...products].sort((a, b) => a.name.localeCompare(b.name, locale)),
        [products, locale],
    );

    const itemProductValue = useMemo(() => {
        if (!draft) return "";
        const p = products.find((x) => x.name === draft.item);
        if (p) return p.id;
        if (draft.item.trim()) return "__legacy";
        return "";
    }, [draft, products]);

    const itemProductOptionsEdit = useMemo(() => {
        const base = productsSorted.map((p) => ({ value: p.id, label: `${p.name} · ${p.category}` }));
        if (!draft) {
            return [{ value: "", label: t("drawer.purchase_order.pick_product") }, ...base];
        }
        const hasMatch = products.some((p) => p.name === draft.item);
        if (!hasMatch && draft.item.trim()) {
            return [
                { value: "", label: t("drawer.purchase_order.pick_product") },
                {
                    value: "__legacy",
                    label: tp("drawer.purchase_order.product_legacy", { name: draft.item }),
                },
                ...base,
            ];
        }
        return [{ value: "", label: t("drawer.purchase_order.pick_product") }, ...base];
    }, [productsSorted, products, draft, t, tp]);

    function goNeuesProduct() {
        const returnTo = `/purchase-orders?purchase_order=${purchase_order.id}`;
        const params = new URLSearchParams();
        params.set("new", "1");
        params.set("returnTo", returnTo);
        navigate(`/products?${params.toString()}`);
    }

    async function startEdit() {
        await loadProducts();
        setDraft(draftFromPurchaseOrder(purchase_order));
        setSaveError(null);
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setDraft(null);
        setSaveError(null);
    }

    async function saveEdit() {
        if (!draft) return;
        const quantity = Number(draft.quantity);
        if (!draft.supplier.trim()) {
            setSaveError(t("drawer.purchase_order.validation_supplier"));
            return;
        }
        if (!draft.item.trim()) {
            setSaveError(t("drawer.purchase_order.validation_item"));
            return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            setSaveError(t("drawer.purchase_order.validation_quantity"));
            return;
        }

        setSaveBusy(true);
        setSaveError(null);
        try {
            const updated = await updatePurchaseOrder(purchase_order.id, {
                supplier: draft.supplier.trim(),
                item: draft.item.trim(),
                quantity,
                unit: draft.unit.trim() || null,
                expected_on: draft.expected_on || null,
                remark: draft.remark.trim() || null,
                pharma_consultant: draft.pharma_consultant.trim() || null,
            });
            onUpdated(updated);
            setEditing(false);
            setDraft(null);
            toast(t("drawer.purchase_order.toast_saved"), "success");
        } catch (e) {
            setSaveError(errorMessage(e));
        } finally {
            setSaveBusy(false);
        }
    }

    async function changeStatus(next: OrderStatus) {
        if (purchase_order.status === next) return;
        const previous = purchase_order.status;
        setStatusBusy(true);
        try {
            const updated = await updatePurchaseOrderStatus(purchase_order.id, next);
            onUpdated(updated);
            toast(
                tp("drawer.purchase_order.toast_status", {
                    from: orderStatusDisplay(previous, t).label,
                    to: orderStatusDisplay(next, t).label,
                }),
                "success",
            );
        } catch (e) {
            toast(tp("drawer.purchase_order.toast_status_failed", { message: errorMessage(e) }), "error");
        } finally {
            setStatusBusy(false);
        }
    }

    async function handleDelete() {
        try {
            await deletePurchaseOrder(purchase_order.id);
            toast(t("drawer.purchase_order.toast_deleted"), "success");
            onDeleted(purchase_order.id);
            onClose();
        } catch (e) {
            toast(tp("drawer.purchase_order.toast_delete_failed", { message: errorMessage(e) }), "error");
        } finally {
            setConfirmDelete(false);
        }
    }

    const dash = t("common.dash");
    const amountLabel =
        purchase_order.total_amount != null && Number.isFinite(purchase_order.total_amount)
            ? formatCurrency(purchase_order.total_amount)
            : dash;

    const layer = (
        <>
            <div className="appointment-drawer-head">
                <span className={pill.className}>{pill.label}</span>
                <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                    <XIcon size={18} />
                </button>
            </div>

            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">{t("drawer.purchase_order.eyebrow")}</div>
                <h2 id={titleId} className="appointment-drawer-title">
                    {purchase_order.order_number ?? dash}
                </h2>
                <div className="appointment-drawer-sub">
                    {purchase_order.item} · {purchase_order.supplier}
                </div>
            </div>

            <div className="appointment-drawer-meta-row">
                <div>
                    <div className="appointment-drawer-eyebrow">{t("common.expected")}</div>
                    <div
                        className="appointment-drawer-meta-val"
                        style={overdue ? { color: "var(--red)" } : undefined}
                    >
                        {purchase_order.expected_on ? formatDate(purchase_order.expected_on) : dash}
                    </div>
                </div>
                <div>
                    <div className="appointment-drawer-eyebrow">{t("common.quantity")}</div>
                    <div className="appointment-drawer-meta-val">
                        {purchase_order.quantity}
                        {purchase_order.unit ? ` ${purchase_order.unit}` : ""}
                    </div>
                </div>
                <div>
                    <div className="appointment-drawer-eyebrow">{t("common.amount")}</div>
                    <div className="appointment-drawer-meta-val">{amountLabel}</div>
                </div>
            </div>

            {canWrite && !editing ? (
                <div className="appointment-drawer-section">
                    <div className="appointment-drawer-eyebrow">{t("drawer.purchase_order.status_workflow")}</div>
                    <div className="purchase-order-drawer-workflow">
                        {statusOptions.map((opt) => {
                            const active = opt.value === purchase_order.status;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`btn ${active ? "btn-accent" : "btn-subtle"}`}
                                    onClick={() => void changeStatus(opt.value)}
                                    disabled={statusBusy || active}
                                    aria-pressed={active}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    {overdue ? (
                        <p className="purchase-order-drawer-overdue-hint">{t("drawer.purchase_order.overdue_hint")}</p>
                    ) : null}
                </div>
            ) : null}

            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {editing ? t("drawer.purchase_order.edit_data") : t("drawer.purchase_order.order_data")}
                </div>
                {editing && draft ? (
                    <div className="purchase-order-drawer-edit">
                        {saveError ? <p className="purchase-order-drawer-save-error">{saveError}</p> : null}
                        <Input
                            id="bdrawer-lief"
                            label={t("common.supplier")}
                            value={draft.supplier}
                            onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                        />
                        <Input
                            id="bdrawer-pharma"
                            label={t("drawer.purchase_order.contact")}
                            value={draft.pharma_consultant}
                            onChange={(e) => setDraft({ ...draft, pharma_consultant: e.target.value })}
                        />
                        <div className="purchase-order-drawer-edit-item">
                            <Select
                                id="bdrawer-kind"
                                label={t("drawer.purchase_order.article_product")}
                                value={itemProductValue}
                                onChange={(e) => {
                                    const version = e.target.value;
                                    if (version === "") {
                                        setDraft({ ...draft, item: "" });
                                        return;
                                    }
                                    if (version === "__legacy") return;
                                    const p = products.find((x) => x.id === version);
                                    if (p) setDraft({ ...draft, item: p.name });
                                }}
                                options={itemProductOptionsEdit}
                            />
                            {canAddProduct ? (
                                <Button type="button" variant="secondary" size="sm" onClick={goNeuesProduct}>
                                    {t("drawer.purchase_order.new_product")}
                                </Button>
                            ) : null}
                        </div>
                        <div className="purchase-order-drawer-edit-grid">
                            <Input
                                id="bdrawer-quantity"
                                label={t("common.quantity")}
                                type="number"
                                min={1}
                                value={draft.quantity}
                                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                            />
                            <Input
                                id="bdrawer-unit"
                                label={t("common.unit")}
                                value={draft.unit}
                                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                            />
                        </div>
                        <Input
                            id="bdrawer-erw"
                            label={t("common.expected_on")}
                            type="date"
                            value={draft.expected_on}
                            onChange={(e) => setDraft({ ...draft, expected_on: e.target.value })}
                        />
                        <Textarea
                            id="bdrawer-bem"
                            label={t("common.note")}
                            rows={3}
                            value={draft.remark}
                            onChange={(e) => setDraft({ ...draft, remark: e.target.value })}
                        />
                    </div>
                ) : (
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.supplier")}</div>
                            <div className="appointment-drawer-meta-val">{purchase_order.supplier}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("drawer.purchase_order.contact")}</div>
                            <div className="appointment-drawer-meta-val">{purchase_order.pharma_consultant ?? dash}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.article")}</div>
                            <div className="appointment-drawer-meta-val">{purchase_order.item}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.delivered_on")}</div>
                            <div className="appointment-drawer-meta-val">
                                {purchase_order.delivered_on ? formatDate(purchase_order.delivered_on) : dash}
                            </div>
                        </div>
                        {(purchase_order.remark ?? "").trim() ? (
                            <div className="ios-row">
                                <div className="appointment-drawer-eyebrow">{t("common.note")}</div>
                                <div className="appointment-drawer-meta-val appointment-drawer-meta-val--pre">
                                    {purchase_order.remark}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {!editing ? (
                <div className="appointment-drawer-section">
                    <div className="appointment-drawer-eyebrow">{t("common.metadata")}</div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.status")}</div>
                            <div className="appointment-drawer-meta-val">{orderStatusDisplay(purchase_order.status, t).label}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.created_at")}</div>
                            <div className="appointment-drawer-meta-val">
                                {format(parseISO(purchase_order.created_at), "d. MMM yyyy, HH:mm", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.updated_at")}</div>
                            <div className="appointment-drawer-meta-val">
                                {format(parseISO(purchase_order.updated_at), "d. MMM yyyy, HH:mm", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("common.created_by")}</div>
                            <div className="appointment-drawer-meta-val appointment-drawer-meta-val--mono">
                                {purchase_order.created_by}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {canWrite ? (
                <div className="appointment-drawer-panel-foot">
                    <div className="appointment-drawer-actions row">
                        {editing ? (
                            <>
                                <Button variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button onClick={() => void saveEdit()} loading={saveBusy} disabled={saveBusy}>
                                    {t("common.save")}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => void startEdit()}>
                                    <EditIcon />
                                    {t("common.edit")}
                                </Button>
                                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                                    {t("common.delete")}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title={t("drawer.purchase_order.delete_title")}
                message={tp("drawer.purchase_order.delete_confirm", {
                    num: purchase_order.order_number ?? "",
                })}
                confirmLabel={t("common.delete")}
                danger
            />
        </>
    );

    return createPortal(
        <div className="appointment-drawer-root" role="presentation">
            <button type="button" className="appointment-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="appointment-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="appointment-drawer-body-scroll">{layer}</div>
            </div>
        </div>,
        document.body,
    );
}
