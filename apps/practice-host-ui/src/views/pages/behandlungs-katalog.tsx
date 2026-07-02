import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listBehandlungsKatalog,
    createBehandlungsKatalogItem,
    updateBehandlungsKatalogItem,
    deleteBehandlungsKatalogItem,
} from "@/systems/practice-host/controllers/praxis.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { BehandlungsKatalogItem } from "../../models/types";
import { errorMessage, formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/input";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { EditIcon, TrashIcon } from "@/lib/icons";

const DEFAULT_KATEGORIEN = [
    { value: "Kontrolluntersuchung", label: "Kontrolluntersuchung" },
    { value: "Fuellungstherapie", label: "Füllungstherapie" },
    { value: "Parodontologie", label: "Parodontologie" },
    { value: "Chirurgie", label: "Chirurgie" },
    { value: "Prothetik", label: "Prothetik" },
];

export function BehandlungsKatalogPage() {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("verwaltung.kataloge.write", role) : false;

    const [rows, setRows] = useState<BehandlungsKatalogItem[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [kategorie, setKategorie] = useState("Chirurgie");
    const [customKategorie, setCustomKategorie] = useState("");
    const [name, setName] = useState("");
    const [kosten, setKosten] = useState("");
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<BehandlungsKatalogItem | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editBusy, setEditBusy] = useState(false);

    const kategorieOptions = useMemo(() => {
        const fromDb = new Set(rows.map((r) => r.kategorie));
        DEFAULT_KATEGORIEN.forEach((k) => fromDb.add(k.value));
        return Array.from(fromDb)
            .sort((a, b) => a.localeCompare(b, "de"))
            .map((value) => ({ value, label: value }));
    }, [rows]);

    const categorySelectOptions = useMemo(
        () => [
            ...kategorieOptions,
            { value: "__custom__", label: t("page.behandlungs_katalog.field.category_custom") },
        ],
        [kategorieOptions, t],
    );

    const effectiveKategorie = kategorie === "__custom__" ? customKategorie.trim() : kategorie;

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listBehandlungsKatalog();
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

    const fillFormFromRow = (r: BehandlungsKatalogItem) => {
        const vals = [...new Set(rows.map((x) => x.kategorie))];
        DEFAULT_KATEGORIEN.forEach((k) => vals.push(k.value));
        const uniq = [...new Set(vals)];
        if (uniq.includes(r.kategorie)) {
            setKategorie(r.kategorie);
            setCustomKategorie("");
        } else {
            setKategorie("__custom__");
            setCustomKategorie(r.kategorie);
        }
        setName(r.name);
        setKosten(r.default_kosten != null ? String(r.default_kosten) : "");
    };

    const openCreate = () => {
        setCreating(true);
        setDetailEdit(false);
        setSelected(null);
        setKategorie("Chirurgie");
        setCustomKategorie("");
        setName("");
        setKosten("");
    };

    const cancelCreate = () => {
        setCreating(false);
    };

    const selectRow = (r: BehandlungsKatalogItem) => {
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
        const kat = effectiveKategorie;
        if (!kat || !name.trim()) {
            toast(t("page.behandlungs_katalog.toast.validation"), "error");
            return;
        }
        setCreateBusy(true);
        try {
            const price = kosten.trim() === "" ? null : Number(kosten.replace(",", "."));
            const created = await createBehandlungsKatalogItem({
                kategorie: kat,
                name: name.trim(),
                default_kosten: price != null && Number.isFinite(price) ? price : null,
            });
            toast(t("page.behandlungs_katalog.toast.saved"));
            setName("");
            setKosten("");
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
        const kat = effectiveKategorie;
        if (!kat || !name.trim()) {
            toast(t("page.behandlungs_katalog.toast.validation"), "error");
            return;
        }
        setEditBusy(true);
        try {
            const price = kosten.trim() === "" ? null : Number(kosten.replace(",", "."));
            const updated = await updateBehandlungsKatalogItem(selected.id, {
                kategorie: kat,
                name: name.trim(),
                default_kosten: price != null && Number.isFinite(price) ? price : null,
                sort_order: selected.sort_order,
            });
            toast(t("page.behandlungs_katalog.toast.entry_saved"));
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
            await deleteBehandlungsKatalogItem(deleteId);
            toast(t("page.behandlungs_katalog.toast.deactivated"));
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
        () => [...rows].sort((a, b) => a.kategorie.localeCompare(b.kategorie, "de") || a.name.localeCompare(b.name, "de")),
        [rows],
    );

    if (status === "loading") return <PageLoading label={t("page.behandlungs_katalog.loading")} />;
    if (status === "error" && loadError) {
        return (
            <div className="produkte-page praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader title={t("page.behandlungs_katalog.title")} />
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
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.behandlungs_katalog.new.title")}
                        subtitle={t("page.behandlungs_katalog.new.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label={t("page.behandlungs_katalog.field.category")}
                                value={kategorie}
                                options={categorySelectOptions}
                                onChange={(e) => setKategorie(e.target.value)}
                                disabled={!canWrite}
                            />
                            {kategorie === "__custom__" ? (
                                <Input
                                    label={t("page.behandlungs_katalog.field.category_free")}
                                    value={customKategorie}
                                    onChange={(e) => setCustomKategorie(e.target.value)}
                                    disabled={!canWrite}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label={t("page.behandlungs_katalog.field.name")} value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
                            <Input
                                label={t("page.behandlungs_katalog.field.cost")}
                                value={kosten}
                                onChange={(e) => setKosten(e.target.value)}
                                placeholder={t("page.behandlungs_katalog.field.optional_ph")}
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
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.behandlungs_katalog.edit.title")}
                        subtitle={t("page.behandlungs_katalog.edit.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                {t("common.cancel")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label={t("page.behandlungs_katalog.field.category")}
                                value={kategorie}
                                options={categorySelectOptions}
                                onChange={(e) => setKategorie(e.target.value)}
                            />
                            {kategorie === "__custom__" ? (
                                <Input
                                    label={t("page.behandlungs_katalog.field.category_free")}
                                    value={customKategorie}
                                    onChange={(e) => setCustomKategorie(e.target.value)}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label={t("page.behandlungs_katalog.field.name")} value={name} onChange={(e) => setName(e.target.value)} />
                            <Input
                                label={t("page.behandlungs_katalog.field.cost")}
                                value={kosten}
                                onChange={(e) => setKosten(e.target.value)}
                                placeholder={t("page.behandlungs_katalog.field.optional_ph")}
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
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={r.name}
                        subtitle={t("page.behandlungs_katalog.entry.subtitle")}
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField(t("page.behandlungs_katalog.field.category"), r.kategorie)}
                            {readField(t("page.behandlungs_katalog.detail.cost"), r.default_kosten != null ? formatCurrency(r.default_kosten) : "—")}
                            {readField(t("page.behandlungs_katalog.detail.sort"), r.sort_order)}
                            {readField(t("page.behandlungs_katalog.detail.status"), r.aktiv ? t("page.behandlungs_katalog.status.active") : t("page.behandlungs_katalog.status.inactive"))}
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("page.behandlungs_katalog.select_hint_write")
                        : t("page.behandlungs_katalog.select_hint_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.behandlungs_katalog.title")}
                subtitle={t("page.behandlungs_katalog.subtitle")}
                actions={
                    canWrite ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("page.behandlungs_katalog.new_cancel") : t("page.behandlungs_katalog.new_btn")}
                        </Button>
                    ) : null
                }
            />

            {!canWrite ? <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>{t("page.behandlungs_katalog.read_only")}</p> : null}

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="🦷"
                                title={t("page.behandlungs_katalog.empty.title")}
                                description={canWrite ? t("page.behandlungs_katalog.empty.desc_write") : t("page.behandlungs_katalog.empty.desc_read")}
                            />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card tbl-data-card tbl-scroll">
                            <table className="tbl tbl-fluid">
                                <thead>
                                    <tr>
                                        <th scope="col">{t("page.behandlungs_katalog.col.category")}</th>
                                        <th scope="col">{t("page.behandlungs_katalog.col.name")}</th>
                                        <th scope="col" style={{ textAlign: "end" }}>{t("page.behandlungs_katalog.col.standard")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r) => {
                                        const isSel = !creating && selected?.id === r.id;
                                        return (
                                            <tr
                                                key={r.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                onClick={() => selectRow(r)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>{r.kategorie}</td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.name}</span>
                                                </td>
                                                <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
                                                    {r.default_kosten != null ? formatCurrency(r.default_kosten) : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="produkte-workspace__detail">{sidePanel}</div>
            </div>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => !busy && setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.behandlungs_katalog.delete.title")}
                message={t("page.behandlungs_katalog.delete.message")}
                confirmLabel={t("page.behandlungs_katalog.delete.confirm")}
                danger
                loading={busy}
            />
        </div>
    );
}
