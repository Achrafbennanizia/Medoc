import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import type { PraxisDayPlan } from "../../lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig, savePraxisArbeitszeitenConfig } from "../../lib/praxis-planning";
import { errorMessage } from "@/lib/utils";

const DAYS = [
    { key: "mo", label: "Montag" },
    { key: "di", label: "Dienstag" },
    { key: "mi", label: "Mittwoch" },
    { key: "do", label: "Donnerstag" },
    { key: "fr", label: "Freitag" },
    { key: "sa", label: "Samstag" },
    { key: "so", label: "Sonntag" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];
type Arbeitszeiten = Record<DayKey, PraxisDayPlan>;

const defaultPlan: Arbeitszeiten = {
    mo: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    di: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    mi: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    do: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    fr: { aktiv: true, segments: [{ from: "08:00", to: "15:00" }] },
    sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
    so: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
};

export function ArbeitszeitenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [plan, setPlan] = useState<Arbeitszeiten>(defaultPlan);
    const [pauseVon, setPauseVon] = useState("12:30");
    const [pauseBis, setPauseBis] = useState("13:30");
    const [slotMin, setSlotMin] = useState("30");
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void loadPraxisArbeitszeitenConfig().then((parsed) => {
            if (cancelled) return;
            setPlan(parsed.plan);
            setPauseVon(parsed.pauseVon);
            setPauseBis(parsed.pauseBis);
            setSlotMin(parsed.slotMin);
        });
        return () => { cancelled = true; };
    }, []);

    const activeDays = useMemo(() => DAYS.filter((d) => plan[d.key].aktiv).length, [plan]);

    const save = async () => {
        setSaving(true);
        try {
            const prev = await loadPraxisArbeitszeitenConfig();
            await savePraxisArbeitszeitenConfig({ ...prev, plan, pauseVon, pauseBis, slotMin });
            toast("Arbeitszeiten gespeichert");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setSaving(false);
        }
    };

    const addSegment = (dayKey: DayKey) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: [...prev[dayKey].segments, { from: "14:00", to: "18:00" }],
            },
        }));
    };

    const removeSegment = (dayKey: DayKey, idx: number) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: prev[dayKey].segments.filter((_, i) => i !== idx),
            },
        }));
    };

    const updateSegment = (dayKey: DayKey, idx: number, key: "from" | "to", value: string) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: prev[dayKey].segments.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
            },
        }));
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <VerwaltungBackButton />
                <h1 className="page-title" style={{ margin: 0 }}>Arbeitszeiten</h1>
            </div>
            <p className="page-sub" style={{ margin: 0 }}>
                Aktive Arbeitstage: {activeDays} / 7
            </p>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Sprechzeiten pro Tag</h2>
                <div className="col" style={{ gap: 10 }}>
                    {DAYS.map((d) => {
                        const row = plan[d.key];
                        return (
                            <div key={d.key} className="col" style={{ gap: 8, border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                                <Select
                                    label={d.label}
                                    value={row.aktiv ? "1" : "0"}
                                    options={[{ value: "1", label: "Aktiv" }, { value: "0", label: "Frei" }]}
                                    onChange={(e) => setPlan((prev) => ({ ...prev, [d.key]: { ...prev[d.key], aktiv: e.target.value === "1" } }))}
                                />
                                {(row.segments ?? []).map((seg, idx) => (
                                    <div key={`${d.key}-seg-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                        <Input
                                            id={`${d.key}-from-${idx}`}
                                            type="time"
                                            label={`Von (${idx + 1})`}
                                            value={seg.from}
                                            onChange={(e) => updateSegment(d.key, idx, "from", e.target.value)}
                                            disabled={!row.aktiv}
                                        />
                                        <Input
                                            id={`${d.key}-to-${idx}`}
                                            type="time"
                                            label={`Bis (${idx + 1})`}
                                            value={seg.to}
                                            onChange={(e) => updateSegment(d.key, idx, "to", e.target.value)}
                                            disabled={!row.aktiv}
                                        />
                                        {row.segments.length > 1 ? (
                                            <Button type="button" size="sm" variant="ghost" onClick={() => removeSegment(d.key, idx)} disabled={!row.aktiv}>
                                                Entfernen
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                <div>
                                    <Button type="button" size="sm" variant="secondary" onClick={() => addSegment(d.key)} disabled={!row.aktiv}>
                                        + Zeitraum
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Standard für Termine</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="pause-von" type="time" label="Pause von" value={pauseVon} onChange={(e) => setPauseVon(e.target.value)} />
                    <Input id="pause-bis" type="time" label="Pause bis" value={pauseBis} onChange={(e) => setPauseBis(e.target.value)} />
                    <Input id="slot-min" type="number" min={10} step={5} label="Slotdauer (Min)" value={slotMin} onChange={(e) => setSlotMin(e.target.value)} />
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Sonder-Sperrzeiten</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>
                    Tages-/Halbtags-Schließungen und Notfall-Sperren werden separat verwaltet.
                </p>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/sonder-sperrzeiten")}>
                    Sonder-Sperrzeiten öffnen
                </Button>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/praxisplanung")}>Zurück</Button>
                <Button type="button" onClick={() => void save()} disabled={saving} loading={saving}>Speichern</Button>
            </div>
        </div>
    );
}
