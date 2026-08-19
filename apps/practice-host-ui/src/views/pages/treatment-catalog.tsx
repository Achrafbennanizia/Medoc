import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listTreatmentCatalog,
    createTreatmentCatalogItem,
    updateTreatmentCatalogItem,
    deleteTreatmentCatalogItem,
} from "@/systems/practice-host/controllers/practice.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { TreatmentCatalogItem } from "../../models/types";
import { errorMessage, formatCurrency } from "@/lib/utils";
import {
    treatmentCatalogCategoryLabel,
    buildTreatmentCatalogCategoryOptions,
    DEFAULT_CATALOG_CATEGORIES,
} from "@/lib/treatment-catalog-categories";
import { useT, useCollatorLocale } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/input";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon, TrashIcon } from "@/lib/icons";

const DEFAULT_CATEGORY = "Surgery";

export function TreatmentCatalogPage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWrite = role ? allowed("administration.catalogs.write", role) : false;

    const [rows, setRows] = useState<TreatmentCatalogItem[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [category, setCategory] = useState(DEFAULT_CATEGORY);
    const [customCategory, setCustomCategory] = useState("");
    const [name, setName] = useState("");
    const [cost, setCost] = useState("");
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<TreatmentCatalogItem | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editBusy, setEditBusy] = useState(false);

    const categoryOptions = useMemo(() => {
        const fromDb = new Set(rows.map((r) => r.category));
        DEFAULT_CATALOG_CATEGORIES.forEach((value) => fromDb.add(value));
        return buildTreatmentCatalogCategoryOptions(t, fromDb, sortLocale);
    }, [rows, sortLocale, t]);

    const categorySelectOptions = useMemo(
        () => [
            ...categoryOptions,
            { value: "__custom__", label: t("page.treatment_catalog.field.category_custom") },
        ],
        [categoryOptions, t],
    );

    const effectiveCategory = category === "__custom__" ? customCategory.trim() : category;

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listTreatmentCatalog();
            setRows(list);
            setSelected((cur) => (cur ? list.find((x) => x.id === cur.id) ?? null : null));
            setStatus("ready");
        } catch (e) {
            setLoadError(errorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const fillFormFromRow = (r: TreatmentCatalogItem) => {
        const vals = [...new Set(rows.map((x) => x.category))];
        DEFAULT_CATALOG_CATEGORIES.forEach((value) => vals.push(value));
        const uniq = [...new Set(vals)];
        if (uniq.includes(r.category)) {
            setCategory(r.category);
            setCustomCategory("");
        } else {
            setCategory("__custom__");
            setCustomCategory(r.category);
        }
        setName(r.name);
        setCost(r.default_cost != null ? String(r.default_cost) : "");
    };

    const openCreate = () => {
        setCreating(true);
        setDetailEdit(false);
        setSelected(null);
        setCategory(DEFAULT_CATEGORY);
        setCustomCategory("");
        setName("");
        setCost("");
    };

    const cancelCreate = () => {
        setCreating(false);
    };

    const selectRow = (r: TreatmentCatalogItem) => {
        setCreating(false);
        setDetailEdit(false);
        setSelected(r);
    };

    const startEdit = () => {
        if (!selected) return;
        setCreating(false);
        setDetailEdit(true);
        fillFormFromRow(selected);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) fillFormFromRow(selected);
    };

    const handleCreate = async () => {
        if (!canWrite) return;
        const kat = effectiveCategory;
        if (!kat || !name.trim()) {
            toast(t("page.treatment_catalog.toast.validation"), "error");
            return;
        }
        setCreateBusy(true);
        try {
            const price = cost.trim() === "" ? null : Number(cost.replace(",", "."));
            const created = await createTreatmentCatalogItem({
                category: kat,
                name: name.trim(),
                default_cost: price != null && Number.isFinite(price) ? price : null,
            });
            toast(t("page.treatment_catalog.toast.saved"));
            setName("");
            setCost("");
            setCreating(false);
            setSelected(created);
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setCreateBusy(false);
        }
    };

    const handleUpdate = async () => {
        if (!selected || !canWrite) return;
        const kat = effectiveCategory;
        if (!kat || !name.trim()) {
            toast(t("page.treatment_catalog.toast.validation"), "error");
            return;
        }
        setEditBusy(true);
        try {
            const price = cost.trim() === "" ? null : Number(cost.replace(",", "."));
            const updated = await updateTreatmentCatalogItem(selected.id, {
                category: kat,
                name: name.trim(),
                default_cost: price != null && Number.isFinite(price) ? price : null,
                sort_order: selected.sort_order,
            });
            toast(t("page.treatment_catalog.toast.entry_saved"));
            setDetailEdit(false);
            setSelected(updated);
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setEditBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId || !canWrite) return;
        setBusy(true);
        try {
            await deleteTreatmentCatalogItem(deleteId);
            toast(t("page.treatment_catalog.toast.deactivated"));
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            setDetailEdit(false);
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const sorted = useMemo(
        () =>
            [...rows].sort(
                (a, b) =>
                    treatmentCatalogCategoryLabel(t, a.category).localeCompare(
                        treatmentCatalogCategoryLabel(t, b.category),
                        sortLocale,
                    ) || a.name.localeCompare(b.name, sortLocale),
            ),
        [rows, sortLocale, t],
    );

    if (status === "loading") return <PageLoading label={t("page.treatment_catalog.loading")} />;
    if (status === "error" && loadError) {
        return (
            <div className="products-page practice-workspace-page animate-fade-in">
                <AdministrationPageHeader title={t("page.treatment_catalog.title")} />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value === null || value === undefined || value === "" ? "—" : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={t("page.treatment_catalog.new.title")}
                        subtitle={t("page.treatment_catalog.new.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label={t("page.treatment_catalog.field.category")}
                                value={category}
                                options={categorySelectOptions}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={!canWrite}
                            />
                            {category === "__custom__" ? (
                                <Input
                                    label={t("page.treatment_catalog.field.category_free")}
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    disabled={!canWrite}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label={t("page.treatment_catalog.field.name")} value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
                            <Input
                                label={t("page.treatment_catalog.field.cost")}
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder={t("page.treatment_catalog.field.optional_ph")}
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} disabled={!canWrite || createBusy} loading={createBusy}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && detailEdit && canWrite) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={t("page.treatment_catalog.edit.title")}
                        subtitle={t("page.treatment_catalog.edit.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                {t("common.cancel")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label={t("page.treatment_catalog.field.category")}
                                value={category}
                                options={categorySelectOptions}
                                onChange={(e) => setCategory(e.target.value)}
                            />
                            {category === "__custom__" ? (
                                <Input
                                    label={t("page.treatment_catalog.field.category_free")}
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label={t("page.treatment_catalog.field.name")} value={name} onChange={(e) => setName(e.target.value)} />
                            <Input
                                label={t("page.treatment_catalog.field.cost")}
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder={t("page.treatment_catalog.field.optional_ph")}
                            />
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleUpdate()} disabled={editBusy} loading={editBusy}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const r = selected;
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={r.name}
                        subtitle={t("page.treatment_catalog.entry.subtitle")}
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                        <EditIcon size={14} /> {t("common.edit")}
                                    </Button>
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>
                                        <TrashIcon size={14} /> {t("common.remove")}
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="products-read-grid">
                            {readField(
                                t("page.treatment_catalog.field.category"),
                                treatmentCatalogCategoryLabel(t, r.category),
                            )}
                            {readField(t("page.treatment_catalog.detail.cost"), r.default_cost != null ? formatCurrency(r.default_cost) : "—")}
                            {readField(t("page.treatment_catalog.detail.sort"), r.sort_order)}
                            {readField(t("page.treatment_catalog.detail.status"), r.active ? t("page.treatment_catalog.status.active") : t("page.treatment_catalog.status.inactive"))}
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad products-detail-card products-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("page.treatment_catalog.select_hint_write")
                        : t("page.treatment_catalog.select_hint_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="products-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                title={t("page.treatment_catalog.title")}
                subtitle={t("page.treatment_catalog.subtitle")}
                actions={
                    canWrite ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("page.treatment_catalog.new_cancel") : t("page.treatment_catalog.new_btn")}
                        </Button>
                    ) : null
                }
            />

            {!canWrite ? <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>{t("page.treatment_catalog.read_only")}</p> : null}

            <div className="products-workspace">
                <div className="products-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="🦷"
                                title={t("page.treatment_catalog.empty.title")}
                                description={canWrite ? t("page.treatment_catalog.empty.desc_write") : t("page.treatment_catalog.empty.desc_read")}
                            />
                        </Card>
                    ) : (
                        <div className="card products-table-card tbl-data-card tbl-scroll">
                            <table className="tbl tbl-fluid">
                                <thead>
                                    <tr>
                                        <th scope="col">{t("page.treatment_catalog.col.category")}</th>
                                        <th scope="col">{t("page.treatment_catalog.col.name")}</th>
                                        <th scope="col" style={{ textAlign: "end" }}>{t("page.treatment_catalog.col.standard")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r) => {
                                        const isSel = !creating && selected?.id === r.id;
                                        return (
                                            <tr
                                                key={r.id}
                                                className={isSel ? "products-row--selected" : undefined}
                                                onClick={() => selectRow(r)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>{treatmentCatalogCategoryLabel(t, r.category)}</td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.name}</span>
                                                </td>
                                                <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
                                                    {r.default_cost != null ? formatCurrency(r.default_cost) : "—"}
                                                </td>
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

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => !busy && setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.treatment_catalog.delete.title")}
                message={t("page.treatment_catalog.delete.message")}
                confirmLabel={t("page.treatment_catalog.delete.confirm")}
                danger
                loading={busy}
            />
        </div>
    );
}
