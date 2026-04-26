import { useCallback, useEffect, useMemo, useState } from "react";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { FormSection } from "../components/ui/form-section";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { parseEuroInput } from "@/lib/tagesabschluss";
import {
    VERTRAG_INTERVALL_OPTIONS,
    type VertragIntervall,
    type VertragItem,
    formatMonatsaequivalenzText,
    formatVertragLaufzeit,
    formatVertragbetragzeile,
    heuteYmd,
    loadVertraege,
    saveVertraege,
    vertragAktivHeute,
} from "@/lib/vertrag-local";
import { EditIcon } from "@/lib/icons";

type LaufzeitModus = "unbefristet" | "befristet";

const LAUFZEIT_OPTIONS: { value: LaufzeitModus; label: string }[] = [
    { value: "unbefristet", label: "Unbefristet (offen, kein festes Enddatum)" },
    { value: "befristet", label: "Befristet (Laufzeit von – bis)" },
];

type FormState = {
    bezeichnung: string;
    partner: string;
    betrag: string;
    intervall: VertragIntervall;
    laufzeitModus: LaufzeitModus;
    periodeVon: string;
    periodeBis: string;
};

function emptyForm(): FormState {
    return {
        bezeichnung: "",
        partner: "",
        betrag: "",
        intervall: "MONAT",
        laufzeitModus: "unbefristet",
        periodeVon: "",
        periodeBis: "",
    };
}

function formFromVertrag(v: VertragItem): FormState {
    return {
        bezeichnung: v.bezeichnung,
        partner: v.partner,
        betrag: v.betrag === 0 ? "" : String(v.betrag),
        intervall: v.intervall,
        laufzeitModus: v.unbefristet ? "unbefristet" : "befristet",
        periodeVon: v.periodeVon ?? "",
        periodeBis: v.periodeBis ?? "",
    };
}

/**
 * Dauer- und Dienstverträge — wie Produkte: Liste links, Erfassung & Bearbeiten rechts, lokale Speicherung.
 */
export function VerwaltungVertraegePage() {
    const toast = useToastStore((s) => s.add);
    const [vertraege, setVertraege] = useState<VertragItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<VertragItem | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState | "periode", string>>>({});
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        setVertraege(loadVertraege());
        setHydrated(true);
    }, []);

    const persist = useCallback((rows: VertragItem[]) => {
        setVertraege(rows);
        saveVertraege(rows);
    }, []);

    const validate = (f: FormState): boolean => {
        const e: typeof formErrors = {};
        if (!f.bezeichnung.trim()) e.bezeichnung = "Bitte Bezeichnung eingeben.";
        if (!f.partner.trim()) e.partner = "Bitte Partner / Lieferant eingeben.";
        const b = f.betrag.trim() === "" ? 0 : parseEuroInput(f.betrag);
        if (b == null) e.betrag = "Ungültiger Betrag.";
        else if (b < 0) e.betrag = "Betrag darf nicht negativ sein.";

        if (f.laufzeitModus === "befristet") {
            if (!f.periodeVon) e.periodeVon = "Von-Datum wählen.";
            if (!f.periodeBis) e.periodeBis = "Bis-Datum wählen.";
            if (f.periodeVon && f.periodeBis && f.periodeVon > f.periodeBis) {
                e.periode = "Von muss vor oder am Bis-Datum liegen.";
            }
        }
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    const openCreate = () => {
        setForm(emptyForm());
        setFormErrors({});
        setCreating(true);
        setSelected(null);
        setDetailEdit(false);
    };

    const cancelCreate = () => {
        setCreating(false);
    };

    const selectRow = (v: VertragItem) => {
        setSelected(v);
        setCreating(false);
        setDetailEdit(false);
    };

    const startEdit = () => {
        if (!selected) return;
        setForm(formFromVertrag(selected));
        setFormErrors({});
        setDetailEdit(true);
        setCreating(false);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) setForm(formFromVertrag(selected));
    };

    const vertragItemFromForm = (f: FormState, id: string, createdAt: string): VertragItem => {
        const b = f.betrag.trim() === "" ? 0 : parseEuroInput(f.betrag)!;
        return {
            id,
            bezeichnung: f.bezeichnung.trim(),
            partner: f.partner.trim(),
            betrag: b,
            intervall: f.intervall,
            unbefristet: f.laufzeitModus === "unbefristet",
            periodeVon: f.laufzeitModus === "befristet" ? f.periodeVon : null,
            periodeBis: f.laufzeitModus === "befristet" ? f.periodeBis : null,
            createdAt,
        };
    };

    const handleCreate = () => {
        if (!validate(form)) return;
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`;
        const row = vertragItemFromForm(form, id, new Date().toISOString());
        persist([row, ...vertraege]);
        setCreating(false);
        setSelected(row);
        toast("Vertrag erfasst.", "success");
    };

    const handleUpdate = () => {
        if (!selected || !validate(form)) return;
        const row = vertragItemFromForm(form, selected.id, selected.createdAt);
        persist(vertraege.map((x) => (x.id === row.id ? row : x)));
        setSelected(row);
        setDetailEdit(false);
        toast("Vertrag gespeichert.", "success");
    };

    const heute = useMemo(() => heuteYmd(), []);

    const readField = (label: string, value: string) => (
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
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value || "—"}</span>
        </div>
    );

    const formBody = (
        <>
            <FormSection title="Vertragspartner & Leistung">
                <Input
                    id="v-bez"
                    label="Bezeichnung"
                    value={form.bezeichnung}
                    onChange={(e) => setForm((p) => ({ ...p, bezeichnung: e.target.value }))}
                    error={formErrors.bezeichnung}
                    placeholder="z. B. Miete, Labor, Versicherung"
                />
                <Input
                    id="v-partner"
                    label="Partner / Anbieter"
                    value={form.partner}
                    onChange={(e) => setForm((p) => ({ ...p, partner: e.target.value }))}
                    error={formErrors.partner}
                    placeholder="Firmenname, Kontakt"
                />
            </FormSection>
            <FormSection title="Kosten & Zahlungsrhythmus">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                    <Input
                        id="v-betrag"
                        label="Betrag (€)"
                        value={form.betrag}
                        onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))}
                        error={formErrors.betrag}
                        placeholder="z. B. 3200 oder 0 (variabel)"
                    />
                    <Select
                        id="v-int"
                        label="Intervall (Betrag gilt …)"
                        value={form.intervall}
                        onChange={(e) => setForm((p) => ({ ...p, intervall: e.target.value as VertragIntervall }))}
                        options={VERTRAG_INTERVALL_OPTIONS}
                    />
                </div>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    Der Betrag bezieht sich exakt auf das gewählte Intervall. „0 €“ = variabler Betrag, nur zur Dokumentation.
                </p>
            </FormSection>
            <FormSection title="Laufzeit">
                <Select
                    id="v-lauf"
                    label="Dauer"
                    value={form.laufzeitModus}
                    onChange={(e) => setForm((p) => ({ ...p, laufzeitModus: e.target.value as LaufzeitModus }))}
                    options={LAUFZEIT_OPTIONS}
                />
                {form.laufzeitModus === "befristet" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                        <Input
                            id="v-von"
                            type="date"
                            label="Laufzeit von"
                            value={form.periodeVon}
                            onChange={(e) => setForm((p) => ({ ...p, periodeVon: e.target.value }))}
                            error={formErrors.periodeVon}
                        />
                        <Input
                            id="v-bis"
                            type="date"
                            label="Laufzeit bis"
                            value={form.periodeBis}
                            onChange={(e) => setForm((p) => ({ ...p, periodeBis: e.target.value }))}
                            min={form.periodeVon || undefined}
                            error={formErrors.periodeBis}
                        />
                    </div>
                ) : (
                    <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                        Unbefristet: kein fester Ablaufdatum; hier nur zur Übersicht.
                    </p>
                )}
                {formErrors.periode ? <p className="page-sub" style={{ color: "var(--red)", margin: 0, fontSize: 12 }}>{formErrors.periode}</p> : null}
            </FormSection>
            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>Stichtag für Laufzeit: {heute}</p>
        </>
    );

    const sidePanel = (() => {
        if (creating) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Neuer Vertrag"
                        subtitle="Erfassung hier rechts — Betrag, Intervall, Laufzeit."
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                Schließen
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={handleCreate}>
                                Speichern
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && detailEdit) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Vertrag bearbeiten"
                        subtitle="Änderungen speichern."
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                                Abbrechen
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={handleUpdate}>
                                Speichern
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const v = selected;
            const aktiv = vertragAktivHeute(v);
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={v.bezeichnung}
                        subtitle="Vertrag"
                        action={(
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                    <EditIcon size={14} /> Bearbeiten
                                </Button>
                                <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(v.id)}>
                                    Löschen
                                </Button>
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {readField("Partner", v.partner)}
                        {readField("Betrag / Intervall", formatVertragbetragzeile(v.betrag, v.intervall))}
                        {readField("Laufzeit", formatVertragLaufzeit(v))}
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            <span className="page-sub" style={{ fontSize: 12, margin: 0 }}>Status (heute):</span>
                            {aktiv ? <Badge variant="success">Aktiv</Badge> : <Badge variant="warning">Außerhalb Laufzeit</Badge>}
                        </div>
                        {readField("Richtwert", formatMonatsaequivalenzText(v))}
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    Wählen Sie eine Zeile in der Tabelle, oder „+ Vertrag erfassen“.
                </p>
            </Card>
        );
    })();

    return (
        <div className="verwaltung-menu-page animate-fade-in">
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Verträge</h2>
                    <p className="page-sub" style={{ maxWidth: 640, marginTop: 4 }}>
                        Laufende Kosten: Betrag pro Tag, Woche, Monat oder Jahr; unbefristet oder mit Laufzeit — Liste links, Details rechts.
                    </p>
                </div>
                <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                    {creating ? "Abbrechen" : "+ Vertrag erfassen"}
                </Button>
            </div>

            {!hydrated ? (
                <p className="page-sub" style={{ margin: 0 }}>Lade Verträge…</p>
            ) : (
                <div className="produkte-workspace">
                    <div className="produkte-workspace__list">
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl" style={{ minWidth: 600 }}>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ width: 40 }} aria-hidden> </th>
                                        <th scope="col">Bezeichnung / Partner</th>
                                        <th scope="col" style={{ textAlign: "right", whiteSpace: "nowrap" }}>Betrag / Intervall</th>
                                        <th scope="col">Laufzeit</th>
                                        <th scope="col" style={{ whiteSpace: "nowrap" }}>Status</th>
                                        <th scope="col" style={{ textAlign: "right", minWidth: 100 }}>Richtwert</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vertraege.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="page-sub" style={{ padding: 20 }}>
                                                Noch keine Verträge. Rechts erfassen oder Tabelle erscheint mit Daten.
                                            </td>
                                        </tr>
                                    ) : (
                                        vertraege.map((v) => {
                                            const aktiv = vertragAktivHeute(v);
                                            const isSel = !creating && selected?.id === v.id;
                                            return (
                                                <tr
                                                    key={v.id}
                                                    className={isSel ? "produkte-row--selected" : undefined}
                                                    onClick={() => selectRow(v)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td style={{ color: "var(--fg-3)" }}>📄</td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{v.bezeichnung}</div>
                                                        <div style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 2 }}>{v.partner}</div>
                                                    </td>
                                                    <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                        {formatVertragbetragzeile(v.betrag, v.intervall)}
                                                    </td>
                                                    <td style={{ fontSize: 13, color: "var(--fg-2)" }}>{formatVertragLaufzeit(v)}</td>
                                                    <td>
                                                        {aktiv ? <Badge variant="success">Aktiv</Badge> : <Badge variant="warning">Außerhalb</Badge>}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontSize: 12, color: "var(--fg-3)" }}>
                                                        {formatMonatsaequivalenzText(v)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="produkte-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deleteId)}
                onClose={() => setDeleteId(null)}
                onConfirm={() => {
                    if (!deleteId) return;
                    const next = vertraege.filter((v) => v.id !== deleteId);
                    persist(next);
                    setSelected((s) => (s?.id === deleteId ? null : s));
                    setDeleteId(null);
                    setDetailEdit(false);
                    toast("Vertrag entfernt.", "success");
                }}
                title="Vertrag löschen?"
                message="Dieser Eintrag wird dauerhaft aus der lokalen Vertragsübersicht entfernt."
                confirmLabel="Löschen"
                danger
            />
        </div>
    );
}
