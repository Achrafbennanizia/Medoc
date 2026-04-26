import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { listProdukte } from "../../controllers/produkt.controller";
import { Card, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { ChevronLeftIcon, EditIcon } from "@/lib/icons";
import {
    listBestellungen,
    updateBestellung,
    updateBestellungStatus,
    deleteBestellung,
    type Bestellung,
    type BestellStatus,
} from "../../controllers/bestellung.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import type { Produkt } from "@/models/types";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

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

function statusBadge(status: BestellStatus, overdue: boolean) {
    if (overdue) return <Badge variant="error">Überfällig</Badge>;
    switch (status) {
        case "OFFEN":
            return <Badge>Offen</Badge>;
        case "UNTERWEGS":
            return <span className="pill blue">Unterwegs</span>;
        case "GELIEFERT":
            return <Badge variant="success">Geliefert</Badge>;
        case "STORNIERT":
            return <Badge variant="error">Storniert</Badge>;
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

export function BestellungDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToastStore((s) => s.add);
    const rolleStr = useAuthStore((s) => s.session?.rolle);
    const role = parseRole(rolleStr);
    const canWrite = role != null && allowed("finanzen.write", role);
    const canAddProdukt = role != null && allowed("produkt.write", role);

    const [bestellung, setBestellung] = useState<Bestellung | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<EditDraft | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [statusBusy, setStatusBusy] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [produkte, setProdukte] = useState<Produkt[]>([]);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setLoadError(null);
        try {
            const [list, prods] = await Promise.all([listBestellungen(), listProdukte()]);
            setProdukte(prods);
            const found = list.find((b) => b.id === id) ?? null;
            if (!found) {
                setLoadError("Bestellung nicht gefunden.");
                setBestellung(null);
            } else {
                setBestellung(found);
            }
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    const overdue = useMemo(() => (bestellung ? isOverdue(bestellung) : false), [bestellung]);

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
        const returnTo = `${location.pathname}${location.search || ""}`;
        const params = new URLSearchParams();
        params.set("neu", "1");
        params.set("returnTo", returnTo);
        navigate(`/produkte?${params.toString()}`);
    }

    function startEdit() {
        if (!bestellung) return;
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
        if (!bestellung || !draft) return;
        const menge = Number(draft.menge);
        if (!draft.lieferant.trim()) { setSaveError("Lieferant erforderlich"); return; }
        if (!draft.artikel.trim()) { setSaveError("Artikel erforderlich"); return; }
        if (!Number.isFinite(menge) || menge <= 0) { setSaveError("Menge muss positiv sein"); return; }

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
            setBestellung(updated);
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
        if (!bestellung || bestellung.status === next) return;
        const previous = bestellung.status;
        setStatusBusy(true);
        try {
            const updated = await updateBestellungStatus(bestellung.id, next);
            setBestellung(updated);
            toast(`Status: ${STATUS_LABEL[previous]} → ${STATUS_LABEL[next]}`, "success");
        } catch (e) {
            toast(`Status-Wechsel fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setStatusBusy(false);
        }
    }

    async function handleDelete() {
        if (!bestellung) return;
        try {
            await deleteBestellung(bestellung.id);
            toast("Bestellung gelöscht", "success");
            navigate("/bestellungen");
        } catch (e) {
            toast(`Löschen fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setConfirmDelete(false);
        }
    }

    if (loading) return <PageLoading label="Bestellung wird geladen…" />;
    if (loadError) return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row" style={{ gap: 8 }}>
                <Button variant="secondary" onClick={() => navigate("/bestellungen")}>
                    <ChevronLeftIcon />Zurück
                </Button>
            </div>
            <PageLoadError message={loadError} onRetry={() => void load()} />
        </div>
    );
    if (!bestellung) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="animate-fade-in">
            {/* Header — Nielsen #3 (user control: clear back path) */}
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <Button variant="secondary" onClick={() => navigate("/bestellungen")}>
                    <ChevronLeftIcon />Zurück
                </Button>
                <div style={{ flex: "1 1 200px" }}>
                    <div className="page-sub" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Bestellung
                    </div>
                    <h2 className="page-title" style={{ margin: 0 }}>
                        {bestellung.bestellnummer ?? "—"}
                    </h2>
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {statusBadge(bestellung.status, overdue)}
                    {!editing && canWrite ? (
                        <>
                            <Button variant="secondary" onClick={startEdit}>
                                <EditIcon />Bearbeiten
                            </Button>
                            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                                Löschen
                            </Button>
                        </>
                    ) : null}
                    {editing ? (
                        <>
                            <Button variant="ghost" onClick={cancelEdit} disabled={saveBusy}>Abbrechen</Button>
                            <Button onClick={() => void saveEdit()} loading={saveBusy} disabled={saveBusy}>
                                Speichern
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Status workflow strip — Nielsen #1 (system status) + #6 (recognition not recall) */}
            {canWrite && !editing ? (
                <Card>
                    <CardHeader title="Status-Workflow" subtitle="Aktueller Status der Bestellung anpassen" />
                    <div style={{ padding: "0 16px 16px" }}>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
                                        style={{ minWidth: 110 }}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {overdue ? (
                            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--red)" }}>
                                Erwartetes Liefer­datum überschritten — Status aktualisieren oder Lieferant kontaktieren.
                            </p>
                        ) : null}
                    </div>
                </Card>
            ) : null}

            {/* Main two-column layout */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
                    gap: 16,
                }}
                className="best-detail-grid"
            >
                {/* Primary card — Bestelldaten */}
                <Card>
                    <CardHeader title="Bestelldaten" subtitle={editing ? "Felder bearbeiten und speichern" : "Übersicht der erfassten Bestellung"} />
                    <div style={{ padding: "0 16px 16px" }}>
                        {editing && draft ? (
                            <>
                                {saveError ? (
                                    <p style={{ color: "var(--red)", fontSize: 12.5, margin: "0 0 8px", padding: "6px 10px", background: "var(--red-soft)", borderRadius: 6 }}>
                                        {saveError}
                                    </p>
                                ) : null}
                                <Input
                                    id="bdetail-lief"
                                    label="Lieferant"
                                    value={draft.lieferant}
                                    onChange={(e) => setDraft({ ...draft, lieferant: e.target.value })}
                                />
                                <Input
                                    id="bdetail-pharma"
                                    label="Pharmaberater / Kontakt"
                                    value={draft.pharmaberater}
                                    onChange={(e) => setDraft({ ...draft, pharmaberater: e.target.value })}
                                />
                                <div className="row" style={{ alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                                        <Select
                                            id="bdetail-art"
                                            label="Artikel (Produkt)"
                                            value={artikelProduktValue}
                                            onChange={(e) => {
                                                if (!draft) return;
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
                                    </div>
                                    {canAddProdukt ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            title="Neues Produkt anlegen (Lager)"
                                            onClick={goNeuesProdukt}
                                            style={{ marginBottom: 8 }}
                                        >
                                            + Produkt
                                        </Button>
                                    ) : null}
                                </div>
                                {editing && draft && produkte.length === 0 && !draft.artikel.trim() ? (
                                    <p style={{ color: "var(--fg-3)", fontSize: 12, margin: "0 0 8px" }}>
                                        Keine Produkte im Lager — zuerst per „+ Produkt“ oder unter Produkte anlegen.
                                    </p>
                                ) : null}
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        id="bdetail-menge"
                                        label="Menge"
                                        type="number"
                                        min={1}
                                        value={draft.menge}
                                        onChange={(e) => setDraft({ ...draft, menge: e.target.value })}
                                    />
                                    <Input
                                        id="bdetail-einheit"
                                        label="Einheit"
                                        value={draft.einheit}
                                        onChange={(e) => setDraft({ ...draft, einheit: e.target.value })}
                                    />
                                </div>
                                <Input
                                    id="bdetail-erw"
                                    label="Erwartet am"
                                    type="date"
                                    value={draft.erwartet_am}
                                    onChange={(e) => setDraft({ ...draft, erwartet_am: e.target.value })}
                                />
                                <Textarea
                                    id="bdetail-bem"
                                    label="Bemerkung"
                                    rows={3}
                                    value={draft.bemerkung}
                                    onChange={(e) => setDraft({ ...draft, bemerkung: e.target.value })}
                                />
                            </>
                        ) : (
                            <dl className="best-dl">
                                <Field label="Lieferant" value={bestellung.lieferant} strong />
                                <Field label="Pharmaberater / Kontakt" value={bestellung.pharmaberater ?? "—"} />
                                <Field label="Artikel" value={bestellung.artikel} />
                                <Field label="Menge" value={`${bestellung.menge}${bestellung.einheit ? ` ${bestellung.einheit}` : ""}`} />
                                <Field
                                    label="Voraussichtlicher Betrag"
                                    value={
                                        bestellung.gesamtbetrag != null && Number.isFinite(bestellung.gesamtbetrag)
                                            ? formatCurrency(bestellung.gesamtbetrag)
                                            : "—"
                                    }
                                />
                                <Field
                                    label="Erwartet am"
                                    value={bestellung.erwartet_am ? formatDate(bestellung.erwartet_am) : "—"}
                                    valueColor={overdue ? "var(--red)" : undefined}
                                />
                                <Field
                                    label="Geliefert am"
                                    value={bestellung.geliefert_am ? formatDate(bestellung.geliefert_am) : "—"}
                                />
                                <Field label="Bemerkung" value={bestellung.bemerkung ?? "—"} multiline />
                            </dl>
                        )}
                    </div>
                </Card>

                {/* Side card — Metadaten + Verlauf */}
                <Card>
                    <CardHeader title="Metadaten" subtitle="Erstellung & technische Daten" />
                    <div style={{ padding: "0 16px 16px" }}>
                        <dl className="best-dl">
                            <Field label="Bestellnummer" value={bestellung.bestellnummer ?? "—"} mono />
                            <Field label="Status" value={STATUS_LABEL[bestellung.status]} />
                            <Field label="Erstellt am" value={formatDateTime(bestellung.created_at)} />
                            <Field label="Zuletzt geändert" value={formatDateTime(bestellung.updated_at)} />
                            <Field label="Erstellt von" value={bestellung.created_by} mono />
                        </dl>
                    </div>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title="Bestellung löschen"
                message={`Möchten Sie die Bestellung ${bestellung.bestellnummer ?? ""} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
                confirmLabel="Löschen"
                danger
            />

            {/* Inline styles for the definition list */}
            <style>{`
                .best-dl { display: grid; grid-template-columns: 160px 1fr; row-gap: 10px; column-gap: 16px; margin: 0; }
                .best-dl dt { font-size: 11.5px; color: var(--fg-3); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; padding-top: 2px; }
                .best-dl dd { margin: 0; font-size: 13.5px; color: var(--fg); word-break: break-word; }
                .best-dl dd.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
                .best-dl dd.multiline { white-space: pre-wrap; }
                @media (max-width: 720px) {
                    .best-dl { grid-template-columns: 1fr; }
                    .best-dl dt { padding-top: 0; }
                    .best-detail-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    strong?: boolean;
    mono?: boolean;
    multiline?: boolean;
    valueColor?: string;
}

function Field({ label, value, strong, mono, multiline, valueColor }: FieldProps) {
    const cls = [mono ? "mono" : null, multiline ? "multiline" : null].filter(Boolean).join(" ");
    return (
        <>
            <dt>{label}</dt>
            <dd className={cls} style={{ fontWeight: strong ? 600 : undefined, color: valueColor }}>
                {value}
            </dd>
        </>
    );
}
