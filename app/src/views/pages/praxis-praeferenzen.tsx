import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_PRAXIS_PRAEFERENZEN,
    loadPraxisPraeferenzenFromKv,
    savePraxisPraeferenzen,
    type PraxisPraeferenzen,
} from "@/lib/praxis-praeferenzen-storage";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

export function PraxisPraeferenzenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
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
        try {
            await savePraxisPraeferenzen(prefs);
            const next = await loadPraxisPraeferenzenFromKv();
            setPrefs(next);
            toast("Praxis-Präferenzen gespeichert");
        } catch (e: unknown) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        }
    };

    if (!hydrated) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
                <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <VerwaltungBackButton />
                    <h1 className="page-title" style={{ margin: 0 }}>Praxis-Präferenzen</h1>
                </div>
                <p className="page-sub">Lade Einstellungen…</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <VerwaltungBackButton />
                <h1 className="page-title" style={{ margin: 0 }}>Praxis-Präferenzen</h1>
            </div>

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

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/praxisplanung")}>Zurück</Button>
                <Button type="button" onClick={save}>Speichern</Button>
            </div>
        </div>
    );
}
