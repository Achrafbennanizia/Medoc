import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { PurchaseOrderDetailDrawer } from "../components/purchase-order-detail-drawer";
import { listPurchaseOrders, type PurchaseOrder, type OrderStatus } from "@/systems/practice-host/controllers/purchase-order.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { errorMessage, formatDate, formatCurrency } from "@/lib/utils";
import { orderStatusDisplay } from "@/lib/finance-order-labels";
import { useT, useTParams } from "@/lib/i18n";
import { WorkspacePageHeader } from "../components/administration-page-header";

type StatusFilter = "ALL" | OrderStatus;

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: PurchaseOrder): boolean {
    if (!b.expected_on) return false;
    if (b.status === "DELIVERED" || b.status === "CANCELLED") return false;
    return b.expected_on < todayISO();
}

function statusBadgeReadonly(status: OrderStatus, overdue: boolean, t: (key: string) => string) {
    if (overdue) return <Badge variant="error">{t("page.purchase-orders.status.overdue")}</Badge>;
    const st = orderStatusDisplay(status, t);
    if (status === "IN_TRANSIT") return <span className="pill blue">{st.label}</span>;
    if (status === "DELIVERED") return <Badge variant="success">{st.label}</Badge>;
    if (status === "CANCELLED") return <Badge variant="error">{st.label}</Badge>;
    return <Badge>{st.label}</Badge>;
}

export function PurchaseOrdersPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const roleStr = useAuthStore((s) => s.session?.role);
    const role = parseRole(roleStr);
    const canWrite = role != null && allowed("purchase_order.write", role);
    const canAddProduct = role != null && allowed("product.write", role);

    const selectedId = searchParams.get("purchase_order");

    const [rows, setRows] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const initial = opts?.initial === true;
        if (initial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const list = await listPurchaseOrders();
            setRows(list);
            if (initial) setLoadError(null);
        } catch (e) {
            const msg = errorMessage(e);
            if (initial) setLoadError(msg);
            else toast(tp("common.refresh_failed", { message: msg }));
        } finally {
            if (initial) setLoading(false);
        }
    }, [toast, tp]);

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows
            .filter((r) => {
                if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
                if (!q) return true;
                return (
                    r.supplier.toLowerCase().includes(q) ||
                    r.item.toLowerCase().includes(q) ||
                    (r.order_number ?? "").toLowerCase().includes(q) ||
                    (r.pharma_consultant ?? "").toLowerCase().includes(q)
                );
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [rows, search, statusFilter]);

    const selectedPurchaseOrder = useMemo(
        () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
        [rows, selectedId],
    );

    useEffect(() => {
        if (selectedId && !loading && rows.length > 0 && !selectedPurchaseOrder) {
            setSearchParams({}, { replace: true });
        }
    }, [selectedId, loading, rows.length, selectedPurchaseOrder, setSearchParams]);

    const openDrawer = (id: string) => {
        setSearchParams({ purchase_order: id });
    };

    const closeDrawer = () => {
        setSearchParams({});
    };

    const handleUpdated = (updated: PurchaseOrder) => {
        setRows((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    };

    const handleDeleted = (id: string) => {
        setRows((list) => list.filter((row) => row.id !== id));
    };

    const statusOptions = useMemo(
        () => [
            { value: "ALL" as const, label: tp("page.purchase-orders.status.all", { count: rows.length }) },
            { value: "OPEN" as const, label: t("page.purchase_orders.status.open") },
            { value: "IN_TRANSIT" as const, label: t("page.purchase-orders.status.inTransit") },
            { value: "DELIVERED" as const, label: t("page.purchase-orders.status.delivered") },
            { value: "CANCELLED" as const, label: t("page.purchase-orders.status.cancelled") },
        ],
        [rows.length, t, tp],
    );

    if (loading) return <PageLoading label={t("page.purchase-orders.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />;

    return (
        <div className="purchase-orders-page practice-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.purchase-orders.title")}
                subtitle={t("page.purchase-orders.subtitle_v2")}
                actions={
                    canWrite ? (
                        <Button onClick={() => navigate("/purchase-orders/new")}>{t("page.purchase-orders.cta_new")}</Button>
                    ) : null
                }
            />

            <div className="page-toolbar">
                <div className="page-toolbar__search">
                    <Input
                        id="best-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("page.purchase-orders.search_ph")}
                        disabled={rows.length === 0}
                    />
                </div>
                <div className="page-toolbar__filters" style={{ width: 200, maxWidth: "100%" }}>
                    <Select
                        id="best-status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        disabled={rows.length === 0}
                        options={statusOptions}
                    />
                </div>
                {rows.length > 0 && (search || statusFilter !== "ALL") ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
                        {t("common.reset")}
                    </Button>
                ) : null}
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    icon="📦"
                    title={t("page.purchase-orders.empty_title")}
                    description={
                        canWrite ? t("page.purchase-orders.empty_write_desc") : t("page.purchase-orders.empty_desc")
                    }
                    action={
                        canWrite
                            ? { label: t("page.purchase-orders.cta_new"), onClick: () => navigate("/purchase-orders/new") }
                            : undefined
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon="🔎"
                    title={t("page.purchase-orders.empty_filtered_title")}
                    description={t("page.purchase-orders.empty_filtered_desc")}
                    action={{
                        label: t("common.reset_filters"),
                        onClick: () => { setSearch(""); setStatusFilter("ALL"); },
                    }}
                />
            ) : (
                <div className="card purchase-orders-table-card tbl-data-card card--overflow-visible">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-purchase-orders">
                        <colgroup>
                            <col className="purchase-orders-col-nr" />
                            <col className="purchase-orders-col-lief" />
                            <col className="purchase-orders-col-kind" />
                            <col className="purchase-orders-col-quantity" />
                            <col className="purchase-orders-col-erw" />
                            <col className="purchase-orders-col-price" />
                            <col className="purchase-orders-col-status" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">{t("page.purchase-orders.col_order_number")}</th>
                                <th scope="col">{t("page.purchase-orders.col.supplier")}</th>
                                <th scope="col">{t("page.purchase-orders.col_item")}</th>
                                <th scope="col">{t("page.purchase-orders.col_quantity")}</th>
                                <th scope="col">{t("page.purchase-orders.col.eta")}</th>
                                <th scope="col">{t("page.purchase-orders.col_price")}</th>
                                <th scope="col">{t("page.purchase-orders.col.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const overdue = isOverdue(r);
                                const isSelected = selectedId === r.id;
                                const rowLabel = tp("page.purchase-orders.open_row", {
                                    label: r.order_number ?? r.id,
                                });
                                const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openDrawer(r.id);
                                    }
                                };
                                return (
                                    <tr
                                        key={r.id}
                                        className={[
                                            "purchase-orders-row",
                                            "purchase-orders-row--clickable",
                                            isSelected ? "purchase-orders-row--selected" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={rowLabel}
                                        aria-pressed={isSelected}
                                        title={t("page.purchase-orders.open_details")}
                                        onClick={() => openDrawer(r.id)}
                                        onKeyDown={onRowKeyDown}
                                    >
                                        <td className="purchase-orders-td-nr">
                                            <span className="purchase-orders-nr">{r.order_number ?? "—"}</span>
                                        </td>
                                        <td className="purchase-orders-td-lief">
                                            <span className="purchase-orders-lief-name">{r.supplier}</span>
                                            {r.pharma_consultant ? (
                                                <span className="purchase-orders-lief-sub">{r.pharma_consultant}</span>
                                            ) : null}
                                        </td>
                                        <td className="purchase-orders-td-kind">
                                            <span className="purchase-orders-kind">{r.item}</span>
                                        </td>
                                        <td className="purchase-orders-td-quantity">
                                            {r.quantity}
                                            {r.unit ? ` ${r.unit}` : ""}
                                        </td>
                                        <td className="purchase-orders-td-erw">
                                            {r.expected_on ? (
                                                <span className={overdue ? "purchase-orders-erw--late" : undefined}>
                                                    {formatDate(r.expected_on)}
                                                </span>
                                            ) : (
                                                <span className="page-sub">—</span>
                                            )}
                                        </td>
                                        <td className="purchase-orders-td-price">
                                            {r.total_amount != null && Number.isFinite(r.total_amount)
                                                ? formatCurrency(r.total_amount)
                                                : "—"}
                                        </td>
                                        <td className="purchase-orders-td-status">
                                            <div className="purchase-orders-status-cell">
                                                {statusBadgeReadonly(r.status, overdue, t)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            {selectedPurchaseOrder ? (
                <PurchaseOrderDetailDrawer
                    purchase_order={selectedPurchaseOrder}
                    canWrite={canWrite}
                    canAddProduct={canAddProduct}
                    onClose={closeDrawer}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            ) : null}
        </div>
    );
}
