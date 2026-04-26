import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { useToastStore } from "../components/ui/toast-store";
import type { PraxisClosureMode, PraxisClosureRule } from "../../lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig, savePraxisArbeitszeitenConfig } from "../../lib/praxis-planning";
import { errorMessage } from "@/lib/utils";
import { EditIcon, TrashIcon } from "@/lib/icons";

export function SonderSperrzeitenPage() {
    const toast = useToastStore((s) => s.add);
    const [closures, setClosures] = useState<PraxisClosureRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [closureDate, setClosureDate] = useState("");
    const [closureMode, setClosureMode] = useState<PraxisClosureMode>("FULL_DAY");
    const [closurePeriods, setClosurePeriods] = useState<Array<{ from: string; to: string }>>([{ from: "08:00", to: "12:00" }]);
    const [closureReason, setClosureReason] = useState("");
    const [creating, setCreating] = useState(false);
    const [sperrEdit, setSperrEdit] = useState(false);
    const [selected, setSelected] = useState<PraxisClosureRule | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void loadPraxisArbeitszeitenConfig()
            .then((parsed) => {
                if (!cancelled) setClosures(parsed.closures ?? []);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const saveClosures = async (next: PraxisClosureRule[]) => {
        const previous = closures;
        setClosures(next);
        setSelected((s) => (s ? next.find((x) => x.id === s.id) ?? null : null));
        try {
            const cfg = await loadPraxisArbeitszeitenConfig();
            await savePraxisArbeitszeitenConfig({ ...cfg, closures: next });
        } catch (e) {
            setClosures(previous);
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        }
    };

    const openForm = () => {
        setCreating(true);
        setSperrEdit(false);
        setSelected(null);
    };

    const closeForm = () => {
        setCreating(false);
    };

    const fillFormFrom = (r: PraxisClosureRule) => {
        setClosureDate(r.date);
        setClosureMode(r.mode);
        setClosurePeriods(r.periods?.length ? r.periods.map((p) => ({ ...p })) : [{ from: "08:00", to: "12:00" }]);
        setClosureReason(r.reason ?? "");
    };

    const startEditSelected = () => {
        if (!selected) return;
        setCreating(false);
        setSperrEdit(true);
        fillFormFrom(selected);
    };

    const cancelSperrEdit = () => {
        setSperrEdit(false);
        if (selected) fillFormFrom(selected);
    };

    const saveSperrEdit = () => {
        if (!selected) return;
        if (!closureDate) {
            toast("Bitte ein Datum wählen.", "error");
            return;
        }
        if (closureMode === "CUSTOM" && closurePeriods.some((p) => !p.from || !p.to || p.from >= p.to)) {
            toast("Für benutzerdefinierte Sperre bitte alle Zeitblöcke korrekt ausfüllen.", "error");
            return;
        }
        const updated: PraxisClosureRule = {
            ...selected,
            date: closureDate,
            mode: closureMode,
            periods: closureMode === "CUSTOM" ? closurePeriods : [],
            reason: closureReason.trim() || undefined,
        };
        const next = closures
            .map((c) => (c.id === selected.id ? updated : c))
            .sort((a, b) => b.date.localeCompare(a.date));
        void saveClosures(next);
        setSperrEdit(false);
        setSelected(updated);
        toast("Sperrregel gespeichert");
    };

    const selectRow = (r: PraxisClosureRule) => {
        setSelected(r);
        setCreating(false);
        setSperrEdit(false);
    };

    const addClosure = () => {
        if (!closureDate) {
            toast("Bitte ein Datum wählen.", "error");
            return;
        }
        if (closureMode === "CUSTOM" && closurePeriods.some((p) => !p.from || !p.to || p.from >= p.to)) {
            toast("Für benutzerdefinierte Sperre bitte alle Zeitblöcke korrekt ausfüllen.", "error");
            return;
        }
        const row: PraxisClosureRule = {
            id: crypto.randomUUID(),
            date: closureDate,
            mode: closureMode,
            periods: closureMode === "CUSTOM" ? closurePeriods : [],
            reason: closureReason.trim() || undefined,
        };
        const next = [row, ...closures].sort((a, b) => a.date.localeCompare(b.date));
        void saveClosures(next);
        setClosureReason("");
        setClosurePeriods([{ from: "08:00", to: "12:00" }]);
        setSelected(row);
        setCreating(false);
        toast("Sperrzeit hinzugefügt");
    };

    const addNextDayEmergencyClose = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const row: PraxisClosureRule = {
            id: crypto.randomUUID(),
            date: iso,
            mode: "FULL_DAY",
            periods: [],
            reason: "Kurzfristige Praxisschließung",
        };
        const next = [row, ...closures].sort((a, b) => a.date.localeCompare(b.date));
        void saveClosures(next);
        setSelected(row);
        setCreating(false);
        toast("Nächster Tag als geschlossen markiert.");
    };

    const removeClosure = (id: string) => {
        const next = closures.filter((r) => r.id !== id);
        void saveClosures(next);
        setSelected((s) => (s?.id === id ? null : s));
    };

    const addPeriod = () => setClosurePeriods((prev) => [...prev, { from: "14:00", to: "18:00" }]);
    const removePeriod = (idx: number) => setClosurePeriods((prev) => prev.filter((_, i) => i !== idx));
    const updatePeriod = (idx: number, key: "from" | "to", value: string) =>
        setClosurePeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));

    const sorted = useMemo(
        () => [...closures].sort((a, b) => b.date.localeCompare(a.date)),
        [closures],
    );

    const timeLabel = (r: PraxisClosureRule) =>
        r.mode === "CUSTOM" ? (r.periods ?? []).map((p) => `${p.from}–${p.to}`).join(", ") : "—";

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

    const sidePanel = (() => {
        if (creating) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Neue Sperrregel"
                        subtitle="Diese Regeln sperren Slots in „Neuer Termin“."
                        action={
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="danger" onClick={addNextDayEmergencyClose}>
                                    Praxis morgen schließen
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
                                    Schließen
                                </Button>
                            </div>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>
                            Voller Tag, halber Tag oder benutzerdefinierte Zeiträume — wie bisher, jetzt in diesem Bereich.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input id="closure-date" type="date" label="Datum" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
                            <Select
                                id="closure-mode"
                                label="Typ"
                                value={closureMode}
                                onChange={(e) => setClosureMode(e.target.value as PraxisClosureMode)}
                                options={[
                                    { value: "FULL_DAY", label: "Ganzer Tag gesperrt" },
                                    { value: "CUSTOM", label: "Benutzerdefinierte Zeit" },
                                ]}
                            />
                            <Input id="closure-reason" label="Grund (optional)" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} />
                            {closureMode === "CUSTOM" ? (
                                <div className="col" style={{ gap: 8, gridColumn: "1 / -1" }}>
                                    {closurePeriods.map((p, idx) => (
                                        <div key={`period-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                            <Input
                                                id={`closure-from-${idx}`}
                                                type="time"
                                                label={`Von (${idx + 1})`}
                                                value={p.from}
                                                onChange={(e) => updatePeriod(idx, "from", e.target.value)}
                                            />
                                            <Input
                                                id={`closure-to-${idx}`}
                                                type="time"
                                                label={`Bis (${idx + 1})`}
                                                value={p.to}
                                                onChange={(e) => updatePeriod(idx, "to", e.target.value)}
                                            />
                                            {closurePeriods.length > 1 ? (
                                                <Button type="button" size="sm" variant="ghost" onClick={() => removePeriod(idx)}>
                                                    Entfernen
                                                </Button>
                                            ) : null}
                                        </div>
                                    ))}
                                    <div>
                                        <Button type="button" size="sm" variant="secondary" onClick={addPeriod}>
                                            + Zeitraum
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                            <Button type="button" variant="secondary" onClick={() => void addClosure()}>
                                Sperrzeit hinzufügen
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && sperrEdit) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Sperrregel bearbeiten"
                        subtitle="Änderungen unten speichern — gleiche Felder wie bei neuer Regel."
                        action={
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="ghost" onClick={cancelSperrEdit}>
                                    Abbrechen
                                </Button>
                            </div>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input id="closure-date-ed" type="date" label="Datum" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
                            <Select
                                id="closure-mode-ed"
                                label="Typ"
                                value={closureMode}
                                onChange={(e) => setClosureMode(e.target.value as PraxisClosureMode)}
                                options={[
                                    { value: "FULL_DAY", label: "Ganzer Tag gesperrt" },
                                    { value: "CUSTOM", label: "Benutzerdefinierte Zeit" },
                                ]}
                            />
                            <Input id="closure-reason-ed" label="Grund (optional)" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} />
                            {closureMode === "CUSTOM" ? (
                                <div className="col" style={{ gap: 8, gridColumn: "1 / -1" }}>
                                    {closurePeriods.map((p, idx) => (
                                        <div key={`period-ed-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                            <Input
                                                id={`closure-from-ed-${idx}`}
                                                type="time"
                                                label={`Von (${idx + 1})`}
                                                value={p.from}
                                                onChange={(e) => updatePeriod(idx, "from", e.target.value)}
                                            />
                                            <Input
                                                id={`closure-to-ed-${idx}`}
                                                type="time"
                                                label={`Bis (${idx + 1})`}
                                                value={p.to}
                                                onChange={(e) => updatePeriod(idx, "to", e.target.value)}
                                            />
                                            {closurePeriods.length > 1 ? (
                                                <Button type="button" size="sm" variant="ghost" onClick={() => removePeriod(idx)}>
                                                    Entfernen
                                                </Button>
                                            ) : null}
                                        </div>
                                    ))}
                                    <div>
                                        <Button type="button" size="sm" variant="secondary" onClick={addPeriod}>
                                            + Zeitraum
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                            <Button type="button" variant="secondary" onClick={() => void saveSperrEdit()}>
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
                        title={r.date}
                        subtitle={r.mode === "FULL_DAY" ? "Ganzer Tag gesperrt" : "Benutzerdefinierte Zeit"}
                        action={
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={startEditSelected}>
                                    <EditIcon size={14} /> Bearbeiten
                                </Button>
                                <Button type="button" size="sm" variant="danger" onClick={() => removeClosure(r.id)}>
                                    <TrashIcon size={14} /> Entfernen
                                </Button>
                            </div>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField("Datum", r.date)}
                            {readField("Typ", r.mode === "FULL_DAY" ? "Ganzer Tag" : "Benutzerdefiniert")}
                            <div style={{ gridColumn: "1 / -1" }}>{readField("Zeit", timeLabel(r))}</div>
                            <div style={{ gridColumn: "1 / -1" }}>{readField("Grund", r.reason ?? "—")}</div>
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    Wählen Sie eine Sperrzeit in der Tabelle, oder „+ Neue Sperrregel“ für die Eingabe hier.
                </p>
            </Card>
        );
    })();

    if (loading) return <PageLoading label="Sperrzeiten werden geladen…" />;

    return (
        <div className="produkte-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Sonder-Sperrzeiten</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Sperrungen für die Terminplanung — Liste links, neue Regel oder Details rechts (wie Produkte).
                    </p>
                </div>
                <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? closeForm : openForm}>
                    {creating ? "Formular schließen" : "+ Neue Sperrregel"}
                </Button>
            </div>

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState icon="🚫" title="Keine Sonder-Sperrzeiten" description="Rechts eine neue Regel anlegen." />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl" style={{ minWidth: 520 }}>
                                <thead>
                                    <tr>
                                        <th scope="col">Datum</th>
                                        <th scope="col">Typ</th>
                                        <th scope="col">Zeit</th>
                                        <th scope="col">Grund</th>
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
                                                <td style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.date}</td>
                                                <td>{r.mode === "FULL_DAY" ? "Ganzer Tag" : "Benutzerdefiniert"}</td>
                                                <td className="page-sub" style={{ fontSize: 13 }}>{timeLabel(r)}</td>
                                                <td className="page-sub" style={{ fontSize: 13, color: "var(--fg-3)" }}>{r.reason ?? "—"}</td>
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
        </div>
    );
}
