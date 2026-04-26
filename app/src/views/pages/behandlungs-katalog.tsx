import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listBehandlungsKatalog,
    createBehandlungsKatalogItem,
    updateBehandlungsKatalogItem,
    deleteBehandlungsKatalogItem,
} from "../../controllers/praxis.controller";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { BehandlungsKatalogItem } from "../../models/types";
import { errorMessage, formatCurrency } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/input";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { EditIcon, TrashIcon } from "@/lib/icons";

const DEFAULT_KATEGORIEN = [
    { value: "Kontrolluntersuchung", label: "Kontrolluntersuchung" },
    { value: "Fuellungstherapie", label: "Füllungstherapie" },
    { value: "Parodontologie", label: "Parodontologie" },
    { value: "Chirurgie", label: "Chirurgie" },
    { value: "Prothetik", label: "Prothetik" },
];

export function BehandlungsKatalogPage() {
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("personal.write", role) : false;

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
            toast("Kategorie und Leistungsname sind Pflichtfelder.", "error");
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
            toast("Leistung im Katalog gespeichert");
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
            toast("Kategorie und Leistungsname sind Pflichtfelder.", "error");
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
            toast("Katalogeintrag gespeichert");
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
            toast("Eintrag deaktiviert");
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

    if (status === "loading") return <PageLoading label="Katalog wird geladen…" />;
    if (status === "error" && loadError) {
        return (
            <div className="produkte-page animate-fade-in space-y-4">
                <VerwaltungBackButton />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    const readField = (label: string, value: string | number | null | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--fg-4)",
                }}
            >
                {label}
            </span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value === null || value === undefined || value === "" ? "—" : value}</span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Neue Leistung"
                        subtitle="Katalog für die Akte — Erfassung hier rechts."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                Schließen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label="Kategorie"
                                value={kategorie}
                                options={[
                                    ...kategorieOptions,
                                    { value: "__custom__", label: "Neue Kategorie (frei) …" },
                                ]}
                                onChange={(e) => setKategorie(e.target.value)}
                                disabled={!canWrite}
                            />
                            {kategorie === "__custom__" ? (
                                <Input
                                    label="Kategorie (frei)"
                                    value={customKategorie}
                                    onChange={(e) => setCustomKategorie(e.target.value)}
                                    disabled={!canWrite}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label="Leistungsname *" value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
                            <Input
                                label="Standard-Kosten (€)"
                                value={kosten}
                                onChange={(e) => setKosten(e.target.value)}
                                placeholder="optional"
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} disabled={!canWrite || createBusy} loading={createBusy}>
                                Speichern
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
                        title="Eintrag bearbeiten"
                        subtitle="Änderungen speichern — Katalog für die Akte."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                Abbrechen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                            <Select
                                label="Kategorie"
                                value={kategorie}
                                options={[
                                    ...kategorieOptions,
                                    { value: "__custom__", label: "Neue Kategorie (frei) …" },
                                ]}
                                onChange={(e) => setKategorie(e.target.value)}
                            />
                            {kategorie === "__custom__" ? (
                                <Input
                                    label="Kategorie (frei)"
                                    value={customKategorie}
                                    onChange={(e) => setCustomKategorie(e.target.value)}
                                />
                            ) : (
                                <div />
                            )}
                            <Input label="Leistungsname *" value={name} onChange={(e) => setName(e.target.value)} />
                            <Input
                                label="Standard-Kosten (€)"
                                value={kosten}
                                onChange={(e) => setKosten(e.target.value)}
                                placeholder="optional"
                            />
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={() => void handleUpdate()} disabled={editBusy} loading={editBusy}>
                                Speichern
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
                        subtitle="Katalogeintrag"
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                        <EditIcon size={14} /> Bearbeiten
                                    </Button>
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>
                                        <TrashIcon size={14} /> Entfernen
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField("Kategorie", r.kategorie)}
                            {readField("Standard-Kosten", r.default_kosten != null ? formatCurrency(r.default_kosten) : "—")}
                            {readField("Sortierung", r.sort_order)}
                            {readField("Status", r.aktiv ? "Aktiv" : "Inaktiv")}
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? "Wählen Sie eine Leistung in der Tabelle, oder „+ Neue Leistung“ für die Erfassung hier."
                        : "Wählen Sie eine Zeile für Details."}
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Behandlungskatalog</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Vordefinierte Kategorien und Leistungsnamen für die Akte — Liste links, anlegen und Details rechts.
                    </p>
                </div>
                {canWrite ? (
                    <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                        {creating ? "Abbrechen" : "+ Neue Leistung"}
                    </Button>
                ) : null}
            </div>

            {!canWrite ? <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>Nur mit Schreibrecht (z. B. Arzt) bearbeitbar.</p> : null}

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="🦷"
                                title="Keine Einträge im Katalog"
                                description={canWrite ? "Rechts die Maske mit „+ Neue Leistung“ öffnen." : "Keine Leistungen hinterlegt."}
                            />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl" style={{ minWidth: 520 }}>
                                <thead>
                                    <tr>
                                        <th scope="col">Kategorie</th>
                                        <th scope="col">Leistungsname</th>
                                        <th scope="col" style={{ textAlign: "right" }}>Standard</th>
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
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
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
                title="Eintrag entfernen"
                message="Der Katalogeintrag wird deaktiviert und erscheint nicht mehr in der Auswahl."
                confirmLabel="Ja, entfernen"
                danger
                loading={busy}
            />
        </div>
    );
}
