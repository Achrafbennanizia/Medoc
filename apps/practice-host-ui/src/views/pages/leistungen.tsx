import { useT, useTParams, useCollatorLocale } from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { listLeistungen, createLeistung, deleteLeistung, updateLeistung } from "@/systems/practice-host/controllers/leistung.controller";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Leistung } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { EditIcon } from "@/lib/icons";

type LeistungForm = {
    name: string;
    kategorie: string;
    preis: string;
    beschreibung: string;
    aktiv: boolean;
    serviceKind: "standard" | "special_examination";
};

const emptyForm = (): LeistungForm => ({
    name: "",
    kategorie: "",
    preis: "",
    beschreibung: "",
    aktiv: true,
    serviceKind: "standard",
});

function toForm(l: Leistung, specialExamCategory: string): LeistungForm {
    const isSpecialExam = l.kategorie.trim() === specialExamCategory;
    return {
        name: l.name,
        kategorie: l.kategorie,
        preis: String(l.preis),
        beschreibung: l.beschreibung ?? "",
        aktiv: l.aktiv,
        serviceKind: isSpecialExam ? "special_examination" : "standard",
    };
}

function parseForm(f: LeistungForm): {
    name: string;
    kategorie: string;
    preis: number;
    beschreibung: string | undefined;
    aktiv: boolean;
} {
    return {
        name: f.name.trim(),
        kategorie: f.kategorie.trim(),
        preis: Number(String(f.preis).replace(",", ".")),
        beschreibung: f.beschreibung.trim() || undefined,
        aktiv: f.aktiv,
    };
}

function formValid(f: LeistungForm): boolean {
    if (!f.name.trim() || !f.kategorie.trim()) return false;
    const preis = Number(String(f.preis).replace(",", "."));
    if (!Number.isFinite(preis) || preis < 0) return false;
    return true;
}

export function LeistungenPage() {
    const t = useT();
    const tp = useTParams();
    const sortLocale = useCollatorLocale();
    const specialExamCategory = t("leistungen.kind.special_examination_category");
    const [searchParams, setSearchParams] = useSearchParams();
    const [leistungen, setLeistungen] = useState<Leistung[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<LeistungForm>(emptyForm());
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Leistung | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState<LeistungForm>(emptyForm());
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWrite = role != null && allowed("finanzen.write", role);
    const canGoVerwaltung = role != null && allowed("verwaltung.read", role);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const data = await listLeistungen();
                setLeistungen(data);
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

    const neuFromQuery = searchParams.get("neu");
    const kindFromQuery = searchParams.get("kind");
    useEffect(() => {
        if (neuFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm(
            kindFromQuery === "examination"
                ? {
                      ...emptyForm(),
                      serviceKind: "special_examination",
                      kategorie: specialExamCategory,
                  }
                : emptyForm(),
        );
        setDetailEdit(false);
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("neu");
                n.delete("kind");
                return n;
            },
            { replace: true },
        );
    }, [neuFromQuery, kindFromQuery, canWrite, setSearchParams, specialExamCategory]);

    const openCreate = (opts?: { examination?: boolean }) => {
        setCreating(true);
        setSelected(null);
        setCreateForm(
            opts?.examination
                ? {
                      ...emptyForm(),
                      serviceKind: "special_examination",
                      kategorie: specialExamCategory,
                  }
                : emptyForm(),
        );
        setDetailEdit(false);
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm(emptyForm());
    };

    const selectRow = (l: Leistung) => {
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
            const created = await createLeistung({
                name: p.name,
                kategorie: p.kategorie,
                preis: p.preis,
                beschreibung: p.beschreibung,
            });
            toast(t("leistungen.toast.created"), "success");
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
            await updateLeistung(selected.id, {
                name: p.name,
                kategorie: p.kategorie,
                preis: p.preis,
                beschreibung: p.beschreibung ?? null,
                aktiv: p.aktiv,
            });
            setDetailEdit(false);
            toast(t("leistungen.toast.saved"), "success");
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
            await deleteLeistung(id);
            toast(t("leistungen.toast.deleted"), "success");
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

    const leistungenSorted = useMemo(
        () => [...leistungen].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [leistungen, sortLocale],
    );

    const kategorieVorschlaege = useMemo(() => {
        const s = new Set<string>([specialExamCategory]);
        for (const l of leistungen) {
            const k = l.kategorie?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, sortLocale));
    }, [leistungen, specialExamCategory, sortLocale]);

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value === null || value === undefined || value === "" ? t("common.em_dash") : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="leistungen-detail-card">
                    <CardHeader
                        title={t("leistungen.create.title")}
                        subtitle={t("leistungen.create.subtitle")}
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <LeistungFormFields form={createForm} setForm={setCreateForm} idPrefix="lst-new" kategorieVorschlaege={kategorieVorschlaege} showAktiv={false} specialExamCategory={specialExamCategory} />
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
                <Card className="leistungen-detail-card">
                    <CardHeader
                        title={selected.name}
                        subtitle={detailEdit ? t("leistungen.detail.edit_sub") : t("leistungen.detail.read_sub")}
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
                                <LeistungFormFields form={editForm} setForm={setEditForm} idPrefix="lst-edit" kategorieVorschlaege={kategorieVorschlaege} showAktiv specialExamCategory={specialExamCategory} />
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
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="leistungen-read-grid">
                                {readField(t("common.name"), selected.name)}
                                {readField(t("common.category"), selected.kategorie)}
                                {readField(t("common.price_eur"), formatCurrency(selected.preis))}
                                {readField(t("common.status"), selected.aktiv ? t("common.active") : t("common.inactive"))}
                                <div style={{ gridColumn: "1 / -1" }}>{readField(t("common.description"), selected.beschreibung ?? t("common.em_dash"))}</div>
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
            <Card className="card-pad leistungen-detail-card leistungen-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? t("leistungen.panel_empty_write")
                        : t("leistungen.panel_empty_read")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="leistungen-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                showBack={canGoVerwaltung}
                title={t("leistungen.page.title")}
                subtitle={t("leistungen.page.subtitle")}
                actions={
                    canWrite ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => openCreate({ examination: true })}
                            >
                                {t("leistungen.new_examination_btn")}
                            </Button>
                            <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : () => openCreate()}>
                                {creating ? t("leistungen.cancel_create_btn") : t("leistungen.new_btn")}
                            </Button>
                        </div>
                    ) : null
                }
            />

            {loading ? (
                <PageLoading label={t("leistungen.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="leistungen-workspace">
                    <div className="leistungen-workspace__list">
                        {leistungen.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="🦷"
                                    title={t("leistungen.empty")}
                                    description={canWrite ? t("leistungen.empty_create_hint") : t("leistungen.empty_catalog")}
                                />
                            </Card>
                        ) : (
                            <div className="card leistungen-table-card tbl-data-card tbl-scroll">
                                <table className="tbl leistungen-tbl">
                                    <thead>
                                        <tr>
                                            <th scope="col">{t("common.name")}</th>
                                            <th scope="col">{t("common.category")}</th>
                                            <th scope="col" style={{ textAlign: "end" }}>{t("common.price")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leistungenSorted.map((l) => {
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
                                                    className={isSel ? "leistungen-row--selected" : undefined}
                                                    tabIndex={0}
                                                    onClick={() => pick()}
                                                    onKeyDown={onRowKeyDown}
                                                    style={{ cursor: "pointer" }}
                                                    aria-label={tp("common.row_show_aria", { entity: t("leistungen.entity"), name: l.name })}
                                                >
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{l.name}</span>
                                                        {!l.aktiv ? (
                                                            <span style={{ marginInlineStart: 8, display: "inline-block" }}>
                                                                <Badge variant="warning">{t("common.inactive")}</Badge>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{l.kategorie}</td>
                                                    <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(l.preis)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="leistungen-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("leistungen.delete_title")}
                message={t("leistungen.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}

function LeistungFormFields({
    form,
    setForm,
    idPrefix,
    kategorieVorschlaege,
    showAktiv,
    specialExamCategory,
}: {
    form: LeistungForm;
    setForm: (f: LeistungForm | ((p: LeistungForm) => LeistungForm)) => void;
    idPrefix: string;
    kategorieVorschlaege: string[];
    showAktiv: boolean;
    specialExamCategory: string;
}) {
    const t = useT();
    const kategorieDatalistId = useId();
    const serviceKindOptions = [
        { value: "standard", label: t("leistungen.kind.standard") },
        { value: "special_examination", label: t("leistungen.kind.special_examination") },
    ];
    return (
        <>
            <Select
                id={`${idPrefix}-kind`}
                label={t("leistungen.kind.label")}
                value={form.serviceKind}
                options={serviceKindOptions}
                onChange={(e) => {
                    const kind = e.target.value as LeistungForm["serviceKind"];
                    setForm((p) => ({
                        ...p,
                        serviceKind: kind,
                        kategorie: kind === "special_examination" ? specialExamCategory : p.kategorie,
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
                    value={form.kategorie}
                    list={kategorieDatalistId}
                    autoComplete="off"
                    disabled={form.serviceKind === "special_examination"}
                    onChange={(e) => setForm((p) => ({ ...p, kategorie: e.target.value }))}
                />
                <datalist id={kategorieDatalistId}>
                    {kategorieVorschlaege.map((k) => (
                        <option key={k} value={k} />
                    ))}
                </datalist>
            </div>
            <Input
                id={`${idPrefix}-preis`}
                type="number"
                min={0}
                step="0.01"
                label={t("common.price_eur")}
                value={form.preis}
                onChange={(e) => setForm((p) => ({ ...p, preis: e.target.value }))}
            />
            <Textarea
                id={`${idPrefix}-beschr`}
                label={t("common.description")}
                rows={3}
                value={form.beschreibung}
                onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
            />
            {showAktiv ? (
                <label className="row" style={{ gap: 10, alignItems: "center", fontSize: 14, color: "var(--fg-2)" }}>
                    <input
                        type="checkbox"
                        checked={form.aktiv}
                        onChange={(e) => setForm((p) => ({ ...p, aktiv: e.target.checked }))}
                    />
                    {t("leistungen.aktiv_hint")}
                </label>
            ) : null}
        </>
    );
}
