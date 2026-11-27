import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";
import { usePageRefresh } from "../layouts/page-refresh";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { DataTable } from "../components/ui/data-table";
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
import { isGuestSession } from "@/systems/practice-host/controllers/guest.controller";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { purchaseOrderIsOverdue } from "@/lib/purchase-order-is-overdue";
import { OrderDoctorCell, OrderDoctorFilter, OrderHiddenDoctorsNote } from "./purchase-order-doctor";
import { useDoctorList } from "../components/use-doctor-list";

type StatusFilter = "ALL" | OrderStatus;

function statusBadgeReadonly(status: OrderStatus, overdue: boolean, t: (key: string) => string) {
    if (overdue) return <Badge variant="error">{t("page.purchase_orders.status.overdue")}</Badge>;
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
    const overrides = useAuthStore((s) => s.session?.permission_overrides);
    const role = parseRole(roleStr);
    const guest = isGuestSession();
    // Guests may confirm deliveries but never create orders (blind the CTA).
    const canWrite = !guest && role != null && allowed("purchase_order.write", role, overrides);
    const canReceive =
        role != null &&
        (allowed("purchase_order.receive", role, overrides) || allowed("purchase_order.write", role, overrides));
    const canAddProduct = !guest && role != null && allowed("product.write", role, overrides);

    const selectedId = searchParams.get("purchase_order");

    const [rows, setRows] = useState<PurchaseOrder[]>(() => readListSnapshot<PurchaseOrder[]>("purchase-orders") ?? []);
    const [loading, setLoading] = useState(() => !readListSnapshot<PurchaseOrder[]>("purchase-orders"));
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [doctorFilter, setDoctorFilter] = useState("");
    const [hiddenDoctors, setHiddenDoctors] = useState<string[]>([]);
    const orderDoctors = useDoctorList();

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const initial = opts?.initial === true;
        if (initial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const resp = await listPurchaseOrders(doctorFilter || undefined);
            setRows(resp.items);
            setHiddenDoctors(resp.hiddenDoctors ?? []);
            writeListSnapshot("purchase-orders", resp.items);
            if (initial) setLoadError(null);
        } catch (e) {
            const msg = errorMessage(e);
            if (initial) setLoadError(msg);
            else toast(tp("common.refresh_failed", { message: msg }));
        } finally {
            if (initial) setLoading(false);
        }
    }, [toast, tp, doctorFilter]);

    const ordersHadCache = useRef(readListSnapshot<PurchaseOrder[]>("purchase-orders") !== undefined);
    useEffect(() => {
        void load({ initial: !ordersHadCache.current });
        ordersHadCache.current = false;
    }, [load]);

    usePageRefresh(() => {
        void load({ initial: false });
    });

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
            { value: "ALL" as const, label: tp("page.purchase_orders.status.all", { count: rows.length }) },
            { value: "OPEN" as const, label: t("page.purchase_orders.status.open") },
            { value: "IN_TRANSIT" as const, label: t("page.purchase_orders.status.inTransit") },
            { value: "DELIVERED" as const, label: t("page.purchase_orders.status.delivered") },
            { value: "CANCELLED" as const, label: t("page.purchase_orders.status.cancelled") },
        ],
        [rows.length, t, tp],
    );

    if (loading) return <PageLoading label={t("page.purchase_orders.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />;

    return (
        <div className="purchase-orders-page practice-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.purchase_orders.title")}
                subtitle={t("page.purchase_orders.subtitle_v2")}
                actions={
                    canWrite ? (
                        <Button onClick={() => navigate("/purchase-orders/new")}>{t("page.purchase_orders.cta_new")}</Button>
                    ) : null
                }
            />

            <div className="page-toolbar">
                <div className="page-toolbar__search">
                    <Input
                        id="best-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("page.purchase_orders.search_ph")}
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
                <OrderDoctorFilter od={orderDoctors} value={doctorFilter} onChange={setDoctorFilter} hidden={hiddenDoctors} />
                {(rows.length > 0 || doctorFilter) && (search || statusFilter !== "ALL" || doctorFilter) ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); setDoctorFilter(""); }}>
                        {t("common.reset")}
                    </Button>
                ) : null}
            </div>

            <OrderHiddenDoctorsNote od={orderDoctors} ids={hiddenDoctors} />

            {rows.length === 0 && !doctorFilter ? (
                <EmptyState
                    icon="📦"
                    title={t("page.purchase_orders.empty_title")}
                    description={
                        canWrite ? t("page.purchase_orders.empty_write_desc") : t("page.purchase_orders.empty_desc")
                    }
                    action={
                        canWrite
                            ? { label: t("page.purchase_orders.cta_new"), onClick: () => navigate("/purchase-orders/new") }
                            : undefined
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon="🔎"
                    title={t("page.purchase_orders.empty_filtered_title")}
                    description={t("page.purchase_orders.empty_filtered_desc")}
                    action={{
                        label: t("common.reset_filters"),
                        onClick: () => { setSearch(""); setStatusFilter("ALL"); setDoctorFilter(""); },
                    }}
                />
            ) : (
                <div className="card purchase-orders-table-card tbl-data-card card--overflow-visible">
                    <DataTable
                        label={t("page.purchase_orders.title")}
                        rows={filtered}
                        getRowId={(r) => r.id}
                        selectedId={selectedId}
                        onRowActivate={(r) => openDrawer(r.id)}
                        rowLabel={(r) => tp("page.purchase_orders.open_row", { label: r.order_number ?? r.id })}
                        columns={[
                            { id: "nr", header: t("page.purchase_orders.col_order_number"), width: "8rem", cell: (r) => <span className="purchase-orders-nr">{r.order_number ?? "—"}</span> },
                            {
                                id: "supplier",
                                header: t("page.purchase_orders.col.supplier"),
                                width: "22%",
                                truncate: true,
                                text: (r) => [r.supplier, r.pharma_consultant].filter(Boolean).join(" · "),
                                cell: (r) => (
                                    <span className="data-table__stack">
                                        <span className="data-table__primary">{r.supplier}</span>
                                        {r.pharma_consultant ? <span className="data-table__secondary">{r.pharma_consultant}</span> : null}
                                    </span>
                                ),
                            },
                            { id: "item", header: t("page.purchase_orders.col_item"), truncate: true, text: (r) => r.item, cell: (r) => r.item },
                            ...(orderDoctors.show
                                ? [{
                                      id: "doctor",
                                      header: t("page.purchase_orders.col_for_doctor"),
                                      width: "10rem",
                                      hideBelow: "md" as const,
                                      cell: (r: PurchaseOrder) => <OrderDoctorCell od={orderDoctors} order={r} />,
                                  }]
                                : []),
                            { id: "qty", header: t("page.purchase_orders.col_quantity"), width: "6.5rem", numeric: true, hideBelow: "md", cell: (r) => `${r.quantity}${r.unit ? ` ${r.unit}` : ""}` },
                            {
                                id: "eta",
                                header: t("page.purchase_orders.col.eta"),
                                width: "7.5rem",
                                hideBelow: "sm",
                                cell: (r) =>
                                    r.expected_on ? (
                                        <span className={purchaseOrderIsOverdue(r) ? "purchase-orders-erw--late" : undefined}>{formatDate(r.expected_on)}</span>
                                    ) : (
                                        <span className="data-table__muted">—</span>
                                    ),
                            },
                            {
                                id: "price",
                                header: t("page.purchase_orders.col_price"),
                                width: "7.5rem",
                                numeric: true,
                                hideBelow: "md",
                                cell: (r) => (r.total_amount != null && Number.isFinite(r.total_amount) ? formatCurrency(r.total_amount) : "—"),
                            },
                            { id: "status", header: t("page.purchase_orders.col.status"), width: "9.5rem", cell: (r) => statusBadgeReadonly(r.status, purchaseOrderIsOverdue(r), t) },
                        ]}
                    />
                </div>
            )}

            {selectedPurchaseOrder ? (
                <PurchaseOrderDetailDrawer
                    purchase_order={selectedPurchaseOrder}
                    canWrite={canWrite}
                    canReceive={canReceive}
                    canAddProduct={canAddProduct}
                    onClose={closeDrawer}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            ) : null}
        </div>
    );
}
