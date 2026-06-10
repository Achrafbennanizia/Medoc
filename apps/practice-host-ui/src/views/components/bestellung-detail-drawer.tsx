import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { Produkt } from "@/models/types";
import {
    deleteBestellung,
    updateBestellung,
    updateBestellungStatus,
    type Bestellung,
    type BestellStatus,
} from "@/systems/practice-host/controllers/bestellung.controller";
import { listProdukte } from "@/systems/practice-host/controllers/produkt.controller";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { EditIcon, XIcon } from "@/lib/icons";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { Input, Select, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

const STATUS_LABEL: Record<BestellStatus, string> = {
    OFFEN: "Offen",
    UNTERWEGS: "Unterwegs",
    GELIEFERT: "Geliefert",
    STORNIERT: "Storniert",
};

const STATUS_OPTIONS: { value: BestellStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "UNTERWEGS", label: "Unterwegs" },
    { value: "GELIEFERT", label: "Geliefert" },
    { value: "STORNIERT", label: "Storniert" },
];

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: Bestellung): boolean {
    if (!b.erwartet_am) return false;
    if (b.status === "GELIEFERT" || b.status === "STORNIERT") return false;
    return b.erwartet_am < todayISO();
}

function statusPill(status: BestellStatus, overdue: boolean): { className: string; label: string } {
    if (overdue) return { className: "pill orange", label: "Überfällig" };
    switch (status) {
        case "OFFEN":
            return { className: "pill grey", label: "Offen" };
        case "UNTERWEGS":
            return { className: "pill blue", label: "Unterwegs" };
        case "GELIEFERT":
            return { className: "pill green", label: "Geliefert" };
        case "STORNIERT":
            return { className: "pill grey", label: "Storniert" };
    }
}

interface EditDraft {
    lieferant: string;
    pharmaberater: string;
    artikel: string;
    menge: string;
    einheit: string;
    erwartet_am: string;
    bemerkung: string;
}

function draftFromBestellung(b: Bestellung): EditDraft {
    return {
        lieferant: b.lieferant,
        pharmaberater: b.pharmaberater ?? "",
        artikel: b.artikel,
        menge: String(b.menge),
        einheit: b.einheit ?? "",
        erwartet_am: b.erwartet_am ?? "",
        bemerkung: b.bemerkung ?? "",
    };
}

export type BestellungDetailDrawerProps = {
    bestellung: Bestellung;
    canWrite: boolean;
    canAddProdukt: boolean;
    onClose: () => void;
    onUpdated: (b: Bestellung) => void;
    onDeleted: (id: string) => void;
};

export function BestellungDetailDrawer({
    bestellung,
    canWrite,
    canAddProdukt,
    onClose,
    onUpdated,
    onDeleted,
}: BestellungDetailDrawerProps) {
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
    const [produkte, setProdukte] = useState<Produkt[]>([]);

    const overdue = useMemo(() => isOverdue(bestellung), [bestellung]);
    const pill = statusPill(bestellung.status, overdue);

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
            panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn")?.focus();
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
    }, [bestellung.id]);

    const loadProdukte = useCallback(async () => {
        try {
            const list = await listProdukte();
            setProdukte(list);
        } catch {
            setProdukte([]);
        }
    }, []);

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [produkte],
    );

    const artikelProduktValue = useMemo(() => {
        if (!draft) return "";
        const p = produkte.find((x) => x.name === draft.artikel);
        if (p) return p.id;
        if (draft.artikel.trim()) return "__legacy";
        return "";
    }, [draft, produkte]);

    const artikelProduktOptionsEdit = useMemo(() => {
        const base = produkteSorted.map((p) => ({ value: p.id, label: `${p.name} · ${p.kategorie}` }));
        if (!draft) {
            return [{ value: "", label: "— Produkt wählen —" }, ...base];
        }
        const hasMatch = produkte.some((p) => p.name === draft.artikel);
        if (!hasMatch && draft.artikel.trim()) {
            return [
                { value: "", label: "— Produkt wählen —" },
                { value: "__legacy", label: `${draft.artikel} (nicht im Lager)` },
                ...base,
            ];
        }
        return [{ value: "", label: "— Produkt wählen —" }, ...base];
    }, [produkteSorted, produkte, draft]);

    function goNeuesProdukt() {
        const returnTo = `/bestellungen?bestellung=${bestellung.id}`;
        const params = new URLSearchParams();
        params.set("neu", "1");
        params.set("returnTo", returnTo);
        navigate(`/produkte?${params.toString()}`);
    }

    async function startEdit() {
        await loadProdukte();
        setDraft(draftFromBestellung(bestellung));
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
        const menge = Number(draft.menge);
        if (!draft.lieferant.trim()) {
            setSaveError("Lieferant erforderlich");
            return;
        }
        if (!draft.artikel.trim()) {
            setSaveError("Artikel erforderlich");
            return;
        }
        if (!Number.isFinite(menge) || menge <= 0) {
            setSaveError("Menge muss positiv sein");
            return;
        }

        setSaveBusy(true);
        setSaveError(null);
        try {
            const updated = await updateBestellung(bestellung.id, {
                lieferant: draft.lieferant.trim(),
                artikel: draft.artikel.trim(),
                menge,
                einheit: draft.einheit.trim() || null,
                erwartet_am: draft.erwartet_am || null,
                bemerkung: draft.bemerkung.trim() || null,
                pharmaberater: draft.pharmaberater.trim() || null,
            });
            onUpdated(updated);
            setEditing(false);
            setDraft(null);
            toast("Änderungen gespeichert", "success");
        } catch (e) {
            setSaveError(errorMessage(e));
        } finally {
            setSaveBusy(false);
        }
    }

    async function changeStatus(next: BestellStatus) {
        if (bestellung.status === next) return;
        const previous = bestellung.status;
        setStatusBusy(true);
        try {
            const updated = await updateBestellungStatus(bestellung.id, next);
            onUpdated(updated);
            toast(`Status: ${STATUS_LABEL[previous]} → ${STATUS_LABEL[next]}`, "success");
        } catch (e) {
            toast(`Status-Wechsel fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setStatusBusy(false);
        }
    }

    async function handleDelete() {
        try {
            await deleteBestellung(bestellung.id);
            toast("Bestellung gelöscht", "success");
            onDeleted(bestellung.id);
            onClose();
        } catch (e) {
            toast(`Löschen fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setConfirmDelete(false);
        }
    }

    const betragLabel =
        bestellung.gesamtbetrag != null && Number.isFinite(bestellung.gesamtbetrag)
            ? formatCurrency(bestellung.gesamtbetrag)
            : "—";

    const layer = (
        <>
            <div className="termin-drawer-head">
                <span className={pill.className}>{pill.label}</span>
                <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
                    <XIcon size={18} />
                </button>
            </div>

            <div className="termin-drawer-section">
                <div className="termin-drawer-eyebrow">Bestellung</div>
                <h2 id={titleId} className="termin-drawer-title">
                    {bestellung.bestellnummer ?? "—"}
                </h2>
                <div className="termin-drawer-sub">
                    {bestellung.artikel} · {bestellung.lieferant}
                </div>
            </div>

            <div className="termin-drawer-meta-row">
                <div>
                    <div className="termin-drawer-eyebrow">Erwartet</div>
                    <div
                        className="termin-drawer-meta-val"
                        style={overdue ? { color: "var(--red)" } : undefined}
                    >
                        {bestellung.erwartet_am ? formatDate(bestellung.erwartet_am) : "—"}
                    </div>
                </div>
                <div>
                    <div className="termin-drawer-eyebrow">Menge</div>
                    <div className="termin-drawer-meta-val">
                        {bestellung.menge}
                        {bestellung.einheit ? ` ${bestellung.einheit}` : ""}
                    </div>
                </div>
                <div>
                    <div className="termin-drawer-eyebrow">Betrag</div>
                    <div className="termin-drawer-meta-val">{betragLabel}</div>
                </div>
            </div>

            {canWrite && !editing ? (
                <div className="termin-drawer-section">
                    <div className="termin-drawer-eyebrow">Status-Workflow</div>
                    <div className="bestellung-drawer-workflow">
                        {STATUS_OPTIONS.map((opt) => {
                            const active = opt.value === bestellung.status;
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
                        <p className="bestellung-drawer-overdue-hint">
                            Erwartetes Lieferdatum überschritten — Status aktualisieren oder Lieferant kontaktieren.
                        </p>
                    ) : null}
                </div>
            ) : null}

            <div className="termin-drawer-section">
                <div className="termin-drawer-eyebrow">
                    {editing ? "Bestelldaten bearbeiten" : "Bestelldaten"}
                </div>
                {editing && draft ? (
                    <div className="bestellung-drawer-edit">
                        {saveError ? <p className="bestellung-drawer-save-error">{saveError}</p> : null}
                        <Input
                            id="bdrawer-lief"
                            label="Lieferant"
                            value={draft.lieferant}
                            onChange={(e) => setDraft({ ...draft, lieferant: e.target.value })}
                        />
                        <Input
                            id="bdrawer-pharma"
                            label="Pharmaberater / Kontakt"
                            value={draft.pharmaberater}
                            onChange={(e) => setDraft({ ...draft, pharmaberater: e.target.value })}
                        />
                        <div className="bestellung-drawer-edit-artikel">
                            <Select
                                id="bdrawer-art"
                                label="Artikel (Produkt)"
                                value={artikelProduktValue}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                        setDraft({ ...draft, artikel: "" });
                                        return;
                                    }
                                    if (v === "__legacy") return;
                                    const p = produkte.find((x) => x.id === v);
                                    if (p) setDraft({ ...draft, artikel: p.name });
                                }}
                                options={artikelProduktOptionsEdit}
                            />
                            {canAddProdukt ? (
                                <Button type="button" variant="secondary" size="sm" onClick={goNeuesProdukt}>
                                    + Produkt
                                </Button>
                            ) : null}
                        </div>
                        <div className="bestellung-drawer-edit-grid">
                            <Input
                                id="bdrawer-menge"
                                label="Menge"
                                type="number"
                                min={1}
                                value={draft.menge}
                                onChange={(e) => setDraft({ ...draft, menge: e.target.value })}
                            />
                            <Input
                                id="bdrawer-einheit"
                                label="Einheit"
                                value={draft.einheit}
                                onChange={(e) => setDraft({ ...draft, einheit: e.target.value })}
                            />
                        </div>
                        <Input
                            id="bdrawer-erw"
                            label="Erwartet am"
                            type="date"
                            value={draft.erwartet_am}
                            onChange={(e) => setDraft({ ...draft, erwartet_am: e.target.value })}
                        />
                        <Textarea
                            id="bdrawer-bem"
                            label="Bemerkung"
                            rows={3}
                            value={draft.bemerkung}
                            onChange={(e) => setDraft({ ...draft, bemerkung: e.target.value })}
                        />
                    </div>
                ) : (
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Lieferant</div>
                            <div className="termin-drawer-meta-val">{bestellung.lieferant}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Pharmaberater / Kontakt</div>
                            <div className="termin-drawer-meta-val">{bestellung.pharmaberater ?? "—"}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Artikel</div>
                            <div className="termin-drawer-meta-val">{bestellung.artikel}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Geliefert am</div>
                            <div className="termin-drawer-meta-val">
                                {bestellung.geliefert_am ? formatDate(bestellung.geliefert_am) : "—"}
                            </div>
                        </div>
                        {(bestellung.bemerkung ?? "").trim() ? (
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">Bemerkung</div>
                                <div className="termin-drawer-meta-val termin-drawer-meta-val--pre">
                                    {bestellung.bemerkung}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {!editing ? (
                <div className="termin-drawer-section">
                    <div className="termin-drawer-eyebrow">Metadaten</div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Status</div>
                            <div className="termin-drawer-meta-val">{STATUS_LABEL[bestellung.status]}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Erstellt am</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(bestellung.created_at), "d. MMM yyyy, HH:mm", { locale: de })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Zuletzt geändert</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(bestellung.updated_at), "d. MMM yyyy, HH:mm", { locale: de })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Erstellt von</div>
                            <div className="termin-drawer-meta-val termin-drawer-meta-val--mono">
                                {bestellung.created_by}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {canWrite ? (
                <div className="termin-drawer-panel-foot">
                    <div className="termin-drawer-actions row">
                        {editing ? (
                            <>
                                <Button variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                    Abbrechen
                                </Button>
                                <Button onClick={() => void saveEdit()} loading={saveBusy} disabled={saveBusy}>
                                    Speichern
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => void startEdit()}>
                                    <EditIcon />
                                    Bearbeiten
                                </Button>
                                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                                    Löschen
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
                title="Bestellung löschen"
                message={`Möchten Sie die Bestellung ${bestellung.bestellnummer ?? ""} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
                confirmLabel="Löschen"
                danger
            />
        </>
    );

    return createPortal(
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label="Schließen" onClick={onClose} />
            <div
                ref={panelRef}
                className="termin-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="termin-drawer-body-scroll">{layer}</div>
            </div>
        </div>,
        document.body,
    );
}
