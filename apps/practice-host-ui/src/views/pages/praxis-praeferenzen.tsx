import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_PRAXIS_PRAEFERENZEN,
    loadPraxisPraeferenzenFromKv,
    normalizeMonthCalendarPatientLoad,
    savePraxisPraeferenzen,
    type MonthCalendarPatientLoadPrefs,
    type PraxisPraeferenzen,
} from "@/lib/praxis-praeferenzen-storage";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";

/** Kuratierte Farben für Monatskalender-Stufen (zusätzlich zum nativen Farbwähler). */
const MONTH_CAL_COLOR_CATALOG: { label: string; hex: string }[] = [
    { label: "Grün", hex: "#22C55E" },
    { label: "Gelb", hex: "#EAB308" },
    { label: "Rot", hex: "#EF4444" },
    { label: "Orange", hex: "#F97316" },
    { label: "Blau", hex: "#3B82F6" },
    { label: "Violett", hex: "#A855F7" },
    { label: "Pink", hex: "#EC4899" },
    { label: "Petrol", hex: "#14B8A6" },
    { label: "Schiefer", hex: "#64748B" },
];

function MonthCalColorField({
    label,
    valueHex,
    onChangeHex,
}: {
    label: string;
    valueHex: string;
    onChangeHex: (hex: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-2)" }}>{label}</span>
            <div className="praxis-month-cal-color-catalog" role="group" aria-label={`Farben für ${label}`}>
                {MONTH_CAL_COLOR_CATALOG.map(({ label: catLabel, hex }) => (
                    <button
                        key={hex + catLabel}
                        type="button"
                        className="praxis-month-cal-swatch"
                        title={`${catLabel} (${hex})`}
                        aria-label={catLabel}
                        style={{ backgroundColor: hex }}
                        onClick={() => onChangeHex(hex)}
                    />
                ))}
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="row" style={{ gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Eigene Farbe</span>
                    <input
                        type="color"
                        value={valueHex}
                        onChange={(e) => onChangeHex(e.target.value)}
                        aria-label={`${label} — frei wählen`}
                        style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" }}
                    />
                </label>
                <code style={{ fontSize: 11, color: "var(--fg-3)" }}>{valueHex}</code>
            </div>
        </div>
    );
}

export function PraxisPraeferenzenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const { canWritePraxisplanung } = useRbac();
    const [prefs, setPrefs] = useState<PraxisPraeferenzen>(DEFAULT_PRAXIS_PRAEFERENZEN);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        void loadPraxisPraeferenzenFromKv()
            .then((v) => setPrefs(v))
            .catch(() => {
                /* keep defaults */
            })
            .finally(() => setHydrated(true));
    }, []);

    const save = async () => {
        if (!canWritePraxisplanung) return;
      try {
            const normalized: PraxisPraeferenzen = {
                ...prefs,
                monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad(prefs.monthCalendarPatientLoad),
            };
            await savePraxisPraeferenzen(normalized);
            const next = await loadPraxisPraeferenzenFromKv();
            setPrefs(next);
            toast("Praxis-Präferenzen gespeichert");
        } catch (e: unknown) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        }
    };

    const patchMonthCalLoad = (patch: Partial<MonthCalendarPatientLoadPrefs>) => {
        setPrefs((p) => ({
            ...p,
            monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad({
                ...p.monthCalendarPatientLoad,
                ...patch,
            }),
        }));
    };

    const ml = prefs.monthCalendarPatientLoad;

    if (!hydrated) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader titleLevel="h1" title="Praxis-Präferenzen" subtitle="Lade Einstellungen…" />
            </div>
        );
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader titleLevel="h1" title="Praxis-Präferenzen" />

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Terminregeln</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        id="pref-puffer"
                        type="number"
                        min={0}
                        label="Puffer zwischen Terminen (Min)"
                        value={prefs.pufferMin}
                        onChange={(e) => setPrefs((p) => ({ ...p, pufferMin: e.target.value }))}
                    />
                    <Input
                        id="pref-notfall"
                        type="number"
                        min={0}
                        label="Notfall-Restzeit (Min)"
                        value={prefs.notfallPuffer}
                        onChange={(e) => setPrefs((p) => ({ ...p, notfallPuffer: e.target.value }))}
                    />
                    <Select
                        label="Reminder vor Termin"
                        value={prefs.reminder}
                        options={[
                            { value: "0", label: "Kein Reminder" },
                            { value: "2", label: "2 Stunden vorher" },
                            { value: "24", label: "24 Stunden vorher" },
                            { value: "48", label: "48 Stunden vorher" },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, reminder: e.target.value }))}
                    />
                    <Select
                        label="No-Show Behandlung"
                        value={prefs.noShow}
                        options={[
                            { value: "warn", label: "Nur markieren" },
                            { value: "fee", label: "Ausfallhinweis in Finanzen" },
                            { value: "block", label: "Patient intern kennzeichnen" },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, noShow: e.target.value }))}
                    />
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Monatskalender: Termine pro Tag</h2>
                <p className="page-sub" style={{ marginTop: -6, marginBottom: 16, maxWidth: 52 * 16 }}>
                    In der Monatsansicht zeigt jeder Tag ein farbiges Badge mit der Anzahl der <strong>Termine</strong> an diesem Tag.
                    Legen Sie fest, ab welcher Zahl die Auslastung als wenig, mittel oder hoch gilt — und welche Farbe dazu passt
                    (Standard: Grün, Gelb, Rot).
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Input
                            id="pref-month-few-max"
                            type="number"
                            min={0}
                            label={`Wenig — höchstens (Termine)`}
                            value={String(ml.fewMax)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                patchMonthCalLoad({
                                    fewMax: Number.isFinite(n) ? Math.max(0, n) : ml.fewMax,
                                });
                            }}
                        />
                        <Input
                            id="pref-month-medium-max"
                            type="number"
                            min={1}
                            label="Mittel — höchstens (Termine, über „wenig“ hinaus)"
                            value={String(ml.mediumMax)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                patchMonthCalLoad({
                                    mediumMax: Number.isFinite(n) ? Math.max(0, n) : ml.mediumMax,
                                });
                            }}
                        />
                        <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                            <strong>Hoch:</strong> mehr als {ml.mediumMax} Termine am Tag (zugehörige Farbe unten).
                        </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <MonthCalColorField
                            label="Farbe „wenig“"
                            valueHex={ml.colorFew}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorFew: hex })}
                        />
                        <MonthCalColorField
                            label="Farbe „mittel“"
                            valueHex={ml.colorMedium}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorMedium: hex })}
                        />
                        <MonthCalColorField
                            label="Farbe „hoch“"
                            valueHex={ml.colorHigh}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorHigh: hex })}
                        />
                    </div>
                </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/praxisplanung")}>Zurück</Button>
                {canWritePraxisplanung ? (
                    <Button type="button" onClick={save}>Speichern</Button>
                ) : null}
            </div>
        </div>
    );
}
