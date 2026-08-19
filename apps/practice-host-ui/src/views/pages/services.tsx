import { useT, useTParams, useCollatorLocale } from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { listServices, createServiceItem, deleteServiceItem, updateServiceItem } from "@/systems/practice-host/controllers/service-item.controller";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { ServiceItem } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon } from "@/lib/icons";

type ServiceItemForm = {
    name: string;
    category: string;
    price: string;
    description: string;
    active: boolean;
    serviceKind: "standard" | "special_examination";
};

const emptyForm = (): ServiceItemForm => ({
    name: "",
    category: "",
    price: "",
    description: "",
    active: true,
    serviceKind: "standard",
});

function toForm(l: ServiceItem, specialExamCategory: string): ServiceItemForm {
    const isSpecialExam = l.category.trim() === specialExamCategory;
    return {
        name: l.name,
        category: l.category,
        price: String(l.price),
        description: l.description ?? "",
        active: l.active,
        serviceKind: isSpecialExam ? "special_examination" : "standard",
    };
}

function parseForm(f: ServiceItemForm): {
    name: string;
    category: string;
    price: number;
    description: string | undefined;
    active: boolean;
} {
    return {
        name: f.name.trim(),
        category: f.category.trim(),
        price: Number(String(f.price).replace(",", ".")),
        description: f.description.trim() || undefined,
        active: f.active,
    };
}

function formValid(f: ServiceItemForm): boolean {
    if (!f.name.trim() || !f.category.trim()) return false;
    const price = Number(String(f.price).replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return false;
    return true;
}

export function ServicesPage() {
    const t = useT();
    const tp = useTParams();
    const sortLocale = useCollatorLocale();
    const specialExamCategory = t("services.kind.special_examination_category");
    const [searchParams, setSearchParams] = useSearchParams();
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<ServiceItemForm>(emptyForm());
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<ServiceItem | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState<ServiceItemForm>(emptyForm());
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWrite = role != null && allowed("finance.write", role);
    const canGoAdministration = role != null && allowed("administration.read", role);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const data = await listServices();
                setServices(data);
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
    const kindFromQuery = searchParams.get("kind");
    useEffect(() => {
        if (newFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm(
            kindFromQuery === "examination"
                ? {
                      ...emptyForm(),
                      serviceKind: "special_examination",
                      category: specialExamCategory,
                  }
                : emptyForm(),
        );
        setDetailEdit(false);
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("new");
                n.delete("kind");
                return n;
            },
            { replace: true },
        );
    }, [newFromQuery, kindFromQuery, canWrite, setSearchParams, specialExamCategory]);

    const openCreate = (opts?: { examination?: boolean }) => {
        setCreating(true);
        setSelected(null);
        setCreateForm(
            opts?.examination
                ? {
                      ...emptyForm(),
                      serviceKind: "special_examination",
                      category: specialExamCategory,
                  }
                : emptyForm(),
        );
        setDetailEdit(false);
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm(emptyForm());
    };

    const selectRow = (l: ServiceItem) => {
        setCreating(false);
        setSelected(l);
        setEditForm(toForm(l, specialExamCategory));
        setDetailEdit(false);
    };

    const handleCreate = async () => {
        if (!formValid(createForm) || !canWrite) return;
        setCreateBusy(true);
        try {
            const p = parseForm(createForm);
            const created = await createServiceItem({
                name: p.name,
                category: p.category,
                price: p.price,
                description: p.description,
            });
            toast(t("services.toast.created"), "success");
            setCreateForm(emptyForm());
            setCreating(false);
            setSelected(created);
            setEditForm(toForm(created, specialExamCategory));
            setDetailEdit(false);
            void load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setCreateBusy(false);
        }
    };

    const handleUpdate = async () => {
        if (!selected || !formValid(editForm) || !canWrite) return;
        setSaveBusy(true);
        try {
            const p = parseForm(editForm);
            await updateServiceItem(selected.id, {
                name: p.name,
                category: p.category,
                price: p.price,
                description: p.description ?? null,
                active: p.active,
            });
            setDetailEdit(false);
            toast(t("services.toast.saved"), "success");
            void load();
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
            await deleteServiceItem(id);
            toast(t("services.toast.deleted"), "success");
            setDeleteId(null);
            setSelected((s) => (s?.id === id ? null : s));
            setDetailEdit(false);
            void load();
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    };

    const cancelEdit = () => {
        if (selected) setEditForm(toForm(selected, specialExamCategory));
        setDetailEdit(false);
    };

    const servicesSorted = useMemo(
        () => [...services].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [services, sortLocale],
    );

    const categorySuggestions = useMemo(() => {
        const s = new Set<string>([specialExamCategory]);
        for (const l of services) {
            const k = l.category?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, sortLocale));
    }, [services, specialExamCategory, sortLocale]);

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value === null || value === undefined || value === "" ? t("common.em_dash") : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="services-detail-card">
                    <CardHeader
                        title={t("services.create.title")}
                        subtitle={t("services.create.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <ServiceItemFormFields form={createForm} setForm={setCreateForm} idPrefix="lst-new" categorySuggestions={categorySuggestions} showActive={false} specialExamCategory={specialExamCategory} />
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} disabled={!formValid(createForm) || createBusy} loading={createBusy}>
                                {t("common.create")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            return (
                <Card className="services-detail-card">
                    <CardHeader
                        title={selected.name}
                        subtitle={detailEdit ? t("services.detail.edit_sub") : t("services.detail.read_sub")}
                        action={canWrite && !detailEdit ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={() => { setDetailEdit(true); setEditForm(toForm(selected, specialExamCategory)); }}>
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
                                <ServiceItemFormFields form={editForm} setForm={setEditForm} idPrefix="lst-edit" categorySuggestions={categorySuggestions} showActive specialExamCategory={specialExamCategory} />
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                    <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                        {t("common.cancel")}
                                    </Button>
                                    <Button type="button" onClick={() => void handleUpdate()} disabled={!formValid(editForm) || saveBusy} loading={saveBusy}>
                                        {t("common.save")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="services-read-grid">
                                {readField(t("common.name"), selected.name)}
                                {readField(t("common.category"), selected.category)}
                                {readField(t("common.price_eur"), formatCurrency(selected.price))}
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
            <Card className="card-pad services-detail-card services-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("services.panel_empty_write")
                        : t("services.panel_empty_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="services-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                showBack={canGoAdministration}
                title={t("services.page.title")}
                subtitle={t("services.page.subtitle")}
                actions={
                    canWrite ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => openCreate({ examination: true })}
                            >
                                {t("services.new_examination_btn")}
                            </Button>
                            <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : () => openCreate()}>
                                {creating ? t("services.cancel_create_btn") : t("services.new_btn")}
                            </Button>
                        </div>
                    ) : null
                }
            />

            {loading ? (
                <PageLoading label={t("services.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="services-workspace">
                    <div className="services-workspace__list">
                        {services.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="🦷"
                                    title={t("services.empty")}
                                    description={canWrite ? t("services.empty_create_hint") : t("services.empty_catalog")}
                                />
                            </Card>
                        ) : (
                            <div className="card services-table-card tbl-data-card tbl-scroll">
                                <table className="tbl services-tbl">
                                    <thead>
                                        <tr>
                                            <th scope="col">{t("common.name")}</th>
                                            <th scope="col">{t("common.category")}</th>
                                            <th scope="col" style={{ textAlign: "end" }}>{t("common.price")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {servicesSorted.map((l) => {
                                            const isSel = !creating && selected?.id === l.id;
                                            const pick = () => selectRow(l);
                                            const onRowKeyDown = (e: KeyboardEvent) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    pick();
                                                }
                                            };
                                            return (
                                                <tr
                                                    key={l.id}
                                                    className={isSel ? "services-row--selected" : undefined}
                                                    tabIndex={0}
                                                    onClick={() => pick()}
                                                    onKeyDown={onRowKeyDown}
                                                    style={{ cursor: "pointer" }}
                                                    aria-label={tp("common.row_show_aria", { entity: t("services.entity"), name: l.name })}
                                                >
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{l.name}</span>
                                                        {!l.active ? (
                                                            <span style={{ marginInlineStart: 8, display: "inline-block" }}>
                                                                <Badge variant="warning">{t("common.inactive")}</Badge>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{l.category}</td>
                                                    <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(l.price)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="services-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("services.delete_title")}
                message={t("services.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}

function ServiceItemFormFields({
    form,
    setForm,
    idPrefix,
    categorySuggestions,
    showActive,
    specialExamCategory,
}: {
    form: ServiceItemForm;
    setForm: (f: ServiceItemForm | ((p: ServiceItemForm) => ServiceItemForm)) => void;
    idPrefix: string;
    categorySuggestions: string[];
    showActive: boolean;
    specialExamCategory: string;
}) {
    const t = useT();
    const categoryDatalistId = useId();
    const serviceKindOptions = [
        { value: "standard", label: t("services.kind.standard") },
        { value: "special_examination", label: t("services.kind.special_examination") },
    ];
    return (
        <>
            <Select
                id={`${idPrefix}-kind`}
                label={t("services.kind.label")}
                value={form.serviceKind}
                options={serviceKindOptions}
                onChange={(e) => {
                    const kind = e.target.value as ServiceItemForm["serviceKind"];
                    setForm((p) => ({
                        ...p,
                        serviceKind: kind,
                        category: kind === "special_examination" ? specialExamCategory : p.category,
                    }));
                }}
            />
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
                    disabled={form.serviceKind === "special_examination"}
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
            <Textarea
                id={`${idPrefix}-beschr`}
                label={t("common.description")}
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            {showActive ? (
                <label className="row" style={{ gap: 10, alignItems: "center", fontSize: 14, color: "var(--fg-2)" }}>
                    <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                    />
                    {t("services.active_hint")}
                </label>
            ) : null}
        </>
    );
}
