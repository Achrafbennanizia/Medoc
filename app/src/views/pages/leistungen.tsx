import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { listLeistungen, createLeistung, deleteLeistung, updateLeistung } from "../../controllers/leistung.controller";
import { errorMessage, formatCurrency, formatDateTime } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Leistung } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { EditIcon } from "@/lib/icons";

type LeistungForm = {
    name: string;
    kategorie: string;
    preis: string;
    beschreibung: string;
    aktiv: boolean;
};

const emptyForm = (): LeistungForm => ({
    name: "",
    kategorie: "",
    preis: "",
    beschreibung: "",
    aktiv: true,
});

function toForm(l: Leistung): LeistungForm {
    return {
        name: l.name,
        kategorie: l.kategorie,
        preis: String(l.preis),
        beschreibung: l.beschreibung ?? "",
        aktiv: l.aktiv,
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
    const canGoVerwaltung = role != null && allowed("personal.read", role);

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
                else toast(`Aktualisieren fehlgeschlagen: ${msg}`, "error");
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        [toast],
    );

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const neuFromQuery = searchParams.get("neu");
    useEffect(() => {
        if (neuFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm(emptyForm());
        setDetailEdit(false);
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("neu");
                return n;
            },
            { replace: true },
        );
    }, [neuFromQuery, canWrite, setSearchParams]);

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

    const selectRow = (l: Leistung) => {
        setCreating(false);
        setSelected(l);
        setEditForm(toForm(l));
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
            toast("Leistung erstellt", "success");
            setCreateForm(emptyForm());
            setCreating(false);
            setSelected(created);
            setEditForm(toForm(created));
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
            toast("Leistung gespeichert", "success");
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
            toast("Leistung gelöscht", "success");
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

    const leistungenSorted = useMemo(
        () => [...leistungen].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [leistungen],
    );

    const kategorieVorschlaege = useMemo(() => {
        const s = new Set<string>();
        for (const l of leistungen) {
            const k = l.kategorie?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, "de"));
    }, [leistungen]);

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value === null || value === undefined || value === "" ? "—" : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="leistungen-detail-card">
                    <CardHeader
                        title="Neue Leistung"
                        subtitle="Erfassung rechts in diesem Bereich, ohne separate Vollbild-Seite."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                Schließen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <LeistungFormFields form={createForm} setForm={setCreateForm} idPrefix="lst-new" kategorieVorschlaege={kategorieVorschlaege} showAktiv={false} />
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} disabled={!formValid(createForm) || createBusy} loading={createBusy}>
                                Erstellen
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
                        subtitle={detailEdit ? "Bearbeiten — Änderungen mit Speichern übernehmen." : "Nur lesen — Bearbeiten öffnet die Eingabefelder."}
                        action={canWrite && !detailEdit ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={() => { setDetailEdit(true); setEditForm(toForm(selected)); }}>
                                    <EditIcon size={14} />
                                    {" "}
                                    Bearbeiten
                                </Button>
                                <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(selected.id)}>
                                    Löschen
                                </Button>
                            </div>
                        ) : null}
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        {detailEdit && canWrite ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <LeistungFormFields form={editForm} setForm={setEditForm} idPrefix="lst-edit" kategorieVorschlaege={kategorieVorschlaege} showAktiv />
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                    <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                        Abbrechen
                                    </Button>
                                    <Button type="button" onClick={() => void handleUpdate()} disabled={!formValid(editForm) || saveBusy} loading={saveBusy}>
                                        Speichern
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="leistungen-read-grid">
                                {readField("Name", selected.name)}
                                {readField("Kategorie", selected.kategorie)}
                                {readField("Preis (€)", formatCurrency(selected.preis))}
                                {readField("Status", selected.aktiv ? "Aktiv" : "Inaktiv")}
                                <div style={{ gridColumn: "1 / -1" }}>{readField("Beschreibung", selected.beschreibung ?? "—")}</div>
                                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--fg-3)" }}>
                                    Zuletzt geändert: {formatDateTime(selected.updated_at)}
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
                        ? "Wählen Sie eine Zeile für Details, oder „+ Neue Leistung“ — die Eingabemaske erscheint hier."
                        : "Wählen Sie eine Zeile in der Tabelle, um die Details zu sehen."}
                </p>
            </Card>
        );
    })();

    return (
        <div className="leistungen-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {canGoVerwaltung ? (
                <div>
                    <VerwaltungBackButton />
                </div>
            ) : null}
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Leistungen</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Katalog und Preise — Liste links, anlegen, lesen und bearbeiten im rechten Bereich.
                    </p>
                </div>
                {canWrite ? (
                    <Button
                        type="button"
                        variant={creating ? "secondary" : "primary"}
                        onClick={creating ? cancelCreate : openCreate}
                        style={{ flexShrink: 0, marginLeft: "auto" }}
                    >
                        {creating ? "Neue Leistung abbrechen" : "+ Neue Leistung"}
                    </Button>
                ) : null}
            </div>

            {loading ? (
                <PageLoading label="Leistungen werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="leistungen-workspace">
                    <div className="leistungen-workspace__list">
                        {leistungen.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="🦷"
                                    title="Keine Leistungen vorhanden"
                                    description={canWrite ? "Rechts erscheint die Maske, sobald Sie „+ Neue Leistung“ wählen." : "Keine Einträge im Katalog."}
                                />
                            </Card>
                        ) : (
                            <div className="card leistungen-table-card tbl-scroll">
                                <table className="tbl leistungen-tbl" style={{ minWidth: 480 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Name</th>
                                            <th scope="col">Kategorie</th>
                                            <th scope="col" style={{ textAlign: "right" }}>Preis</th>
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
                                                    aria-label={`Leistung ${l.name} anzeigen`}
                                                >
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{l.name}</span>
                                                        {!l.aktiv ? (
                                                            <span style={{ marginLeft: 8, display: "inline-block" }}>
                                                                <Badge variant="warning">Inaktiv</Badge>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{l.kategorie}</td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(l.preis)}</td>
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
                title="Leistung löschen"
                message="Möchten Sie diese Leistung wirklich löschen? Eine Löschung deaktiviert den Eintrag im Katalog."
                confirmLabel="Löschen"
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
}: {
    form: LeistungForm;
    setForm: (f: LeistungForm | ((p: LeistungForm) => LeistungForm)) => void;
    idPrefix: string;
    kategorieVorschlaege: string[];
    showAktiv: boolean;
}) {
    const kategorieDatalistId = useId();
    return (
        <>
            <Input
                id={`${idPrefix}-name`}
                label="Name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <div>
                <Input
                    id={`${idPrefix}-kat`}
                    label="Kategorie"
                    value={form.kategorie}
                    list={kategorieDatalistId}
                    autoComplete="off"
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
                label="Preis (€)"
                value={form.preis}
                onChange={(e) => setForm((p) => ({ ...p, preis: e.target.value }))}
            />
            <Textarea
                id={`${idPrefix}-beschr`}
                label="Beschreibung"
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
                    Aktiv (deaktivierte Leistungen erscheinen nicht mehr in der Liste)
                </label>
            ) : null}
        </>
    );
}
