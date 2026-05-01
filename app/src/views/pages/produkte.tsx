import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProdukte, createProdukt, deleteProdukt, updateProdukt } from "../../controllers/produkt.controller";
import { errorMessage, formatCurrency, formatDateTime } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Produkt } from "../../models/types";
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

type ProduktForm = {
    name: string;
    kategorie: string;
    preis: string;
    bestand: string;
    mindestbestand: string;
    beschreibung: string;
};

const emptyForm = (): ProduktForm => ({
    name: "",
    kategorie: "",
    preis: "",
    bestand: "",
    mindestbestand: "",
    beschreibung: "",
});

function toForm(p: Produkt): ProduktForm {
    return {
        name: p.name,
        kategorie: p.kategorie,
        preis: String(p.preis),
        bestand: String(p.bestand),
        mindestbestand: String(p.mindestbestand),
        beschreibung: p.beschreibung ?? "",
    };
}

function parseForm(f: ProduktForm): {
    name: string;
    kategorie: string;
    preis: number;
    bestand: number;
    mindestbestand: number;
    beschreibung: string | undefined;
} {
    return {
        name: f.name.trim(),
        kategorie: f.kategorie.trim(),
        preis: Number(String(f.preis).replace(",", ".")),
        bestand: Math.trunc(Number(f.bestand)),
        mindestbestand: Math.trunc(Number(f.mindestbestand)),
        beschreibung: f.beschreibung.trim() || undefined,
    };
}

function formValid(f: ProduktForm): boolean {
    if (!f.name.trim() || !f.kategorie.trim()) return false;
    const preis = Number(String(f.preis).replace(",", "."));
    if (!Number.isFinite(preis) || preis < 0) return false;
    if (!Number.isFinite(Number(f.bestand)) || !Number.isFinite(Number(f.mindestbestand))) return false;
    return true;
}

function isSafeInternalReturnPath(path: string | null): path is string {
    if (path == null || path.length === 0 || path.length > 4000) return false;
    if (!path.startsWith("/")) return false;
    if (path.startsWith("//") || path.includes("://")) return false;
    return true;
}

export function ProduktePage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    /** Neues Produkt — nur im Seitenpanel */
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<ProduktForm>(emptyForm());
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Produkt | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState<ProduktForm>(emptyForm());
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWrite = role != null && allowed("produkt.write", role);
    const canGoVerwaltung = role != null && allowed("personal.read", role);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const data = await listProdukte();
                setProdukte(data);
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

    const selectRow = (p: Produkt) => {
        setCreating(false);
        setSelected(p);
        setEditForm(toForm(p));
        setDetailEdit(false);
    };

    const handleCreate = async () => {
        if (!formValid(createForm) || !canWrite) return;
        setCreateBusy(true);
        try {
            const p = parseForm(createForm);
            const created = await createProdukt(p);
            toast("Produkt erstellt", "success");
            setCreateForm(emptyForm());
            setCreating(false);
            const returnTo = searchParams.get("returnTo");
            if (isSafeInternalReturnPath(returnTo)) {
                navigate(returnTo, { replace: true });
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
        if (!selected || !formValid(editForm) || !canWrite) return;
        setSaveBusy(true);
        try {
            const p = parseForm(editForm);
            const updated = await updateProdukt(selected.id, {
                name: p.name,
                kategorie: p.kategorie,
                preis: p.preis,
                bestand: p.bestand,
                mindestbestand: p.mindestbestand,
                beschreibung: p.beschreibung ?? null,
            });
            setProdukte((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            setSelected(updated);
            setDetailEdit(false);
            toast("Produkt gespeichert", "success");
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
            await deleteProdukt(id);
            toast("Produkt gelöscht", "success");
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

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [produkte],
    );

    /** Distinct Kategorien aus dem Lager — als Vorschläge für Eingabe + Auswahl (datalist). */
    const kategorieVorschlaege = useMemo(() => {
        const s = new Set<string>();
        for (const p of produkte) {
            const k = p.kategorie?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, "de"));
    }, [produkte]);

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value === null || value === undefined || value === "" ? "—" : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Neues Produkt"
                        subtitle="Erfassung im Lager — erscheint hier rechts, nicht im Dialog."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                Schließen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <ProduktFormFields form={createForm} setForm={setCreateForm} idPrefix="prod-new" kategorieVorschlaege={kategorieVorschlaege} />
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
                <Card className="produkte-detail-card">
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
                                <ProduktFormFields form={editForm} setForm={setEditForm} idPrefix="prod-edit" kategorieVorschlaege={kategorieVorschlaege} />
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
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                                {readField("Name", selected.name)}
                                {readField("Kategorie", selected.kategorie)}
                                {readField("Preis (€)", formatCurrency(selected.preis))}
                                {readField("Bestand", selected.bestand)}
                                {readField("Mindestbestand", selected.mindestbestand)}
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
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? "Wählen Sie eine Zeile für Details, oder „+ Neues Produkt“ — die Eingabemaske erscheint hier."
                        : "Wählen Sie eine Zeile in der Tabelle, um die Details zu sehen."}
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {canGoVerwaltung ? (
                <div>
                    <VerwaltungBackButton />
                </div>
            ) : null}
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Produkte</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Lagerartikel — Liste links, anlegen, lesen und bearbeiten im rechten Bereich.
                    </p>
                </div>
                {canWrite ? (
                    <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                        {creating ? "Neues Produkt abbrechen" : "+ Neues Produkt"}
                    </Button>
                ) : null}
            </div>

            {loading ? (
                <PageLoading label="Produkte werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="produkte-workspace">
                    <div className="produkte-workspace__list">
                        {produkte.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="📦"
                                    title="Keine Produkte vorhanden"
                                    description={canWrite ? "Rechts erscheint die Maske, sobald Sie „+ Neues Produkt“ wählen." : "Keine Einträge im Lager."}
                                />
                            </Card>
                        ) : (
                            <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                                <table className="tbl produkte-tbl" style={{ minWidth: 520 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Name</th>
                                            <th scope="col">Kategorie</th>
                                            <th scope="col" style={{ textAlign: "right" }}>Preis</th>
                                            <th scope="col" style={{ textAlign: "right" }}>Bestand</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {produkteSorted.map((p) => {
                                            const low = p.bestand <= p.mindestbestand;
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
                                                    className={isSel ? "produkte-row--selected" : undefined}
                                                    tabIndex={0}
                                                    onClick={() => pick()}
                                                    onKeyDown={onRowKeyDown}
                                                    style={{ cursor: "pointer" }}
                                                    aria-label={`Produkt ${p.name} anzeigen`}
                                                >
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{p.name}</span>
                                                        {!p.aktiv ? (
                                                            <span style={{ marginLeft: 8, display: "inline-block" }}>
                                                                <Badge variant="warning">Inaktiv</Badge>
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>{p.kategorie}</td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.preis)}</td>
                                                    <td style={{ textAlign: "right" }}>
                                                        {low ? (
                                                            <Badge variant="error">
                                                                {p.bestand} / min. {p.mindestbestand}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-on-surface" style={{ fontVariantNumeric: "tabular-nums" }}>{p.bestand}</span>
                                                        )}
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
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title="Produkt löschen"
                message="Möchten Sie dieses Produkt wirklich löschen? Verknüpfungen in Belegen können betroffen sein."
                confirmLabel="Löschen"
                danger
            />
        </div>
    );
}

function ProduktFormFields({
    form,
    setForm,
    idPrefix,
    kategorieVorschlaege,
}: {
    form: ProduktForm;
    setForm: (f: ProduktForm | ((p: ProduktForm) => ProduktForm)) => void;
    idPrefix: string;
    kategorieVorschlaege: string[];
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                    id={`${idPrefix}-bestand`}
                    type="number"
                    label="Bestand"
                    value={form.bestand}
                    onChange={(e) => setForm((p) => ({ ...p, bestand: e.target.value }))}
                />
                <Input
                    id={`${idPrefix}-mindest`}
                    type="number"
                    label="Mindestbestand"
                    value={form.mindestbestand}
                    onChange={(e) => setForm((p) => ({ ...p, mindestbestand: e.target.value }))}
                />
            </div>
            <Textarea
                id={`${idPrefix}-beschr`}
                label="Beschreibung"
                rows={3}
                value={form.beschreibung}
                onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
            />
        </>
    );
}
