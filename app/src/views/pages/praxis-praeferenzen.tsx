import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const LS_KEY = "medoc-praxis-praeferenzen-v1";

export function PraxisPraeferenzenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [pufferMin, setPufferMin] = useState("5");
    const [notfallPuffer, setNotfallPuffer] = useState("8");
    const [reminder, setReminder] = useState("24");
    const [noShow, setNoShow] = useState("warn");

    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const p = JSON.parse(raw) as { pufferMin?: string; notfallPuffer?: string; reminder?: string; noShow?: string };
            if (p.pufferMin) setPufferMin(p.pufferMin);
            if (p.notfallPuffer) setNotfallPuffer(p.notfallPuffer);
            if (p.reminder) setReminder(p.reminder);
            if (p.noShow) setNoShow(p.noShow);
        } catch {
            // ignore malformed storage
        }
    }, []);

    const save = () => {
        localStorage.setItem(LS_KEY, JSON.stringify({ pufferMin, notfallPuffer, reminder, noShow }));
        toast("Praxis-Präferenzen gespeichert");
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <VerwaltungBackButton />
                <h1 className="page-title" style={{ margin: 0 }}>Praxis-Präferenzen</h1>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>Terminregeln</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="pref-puffer" type="number" min={0} label="Puffer zwischen Terminen (Min)" value={pufferMin} onChange={(e) => setPufferMin(e.target.value)} />
                    <Input id="pref-notfall" type="number" min={0} label="Notfall-Restzeit (Min)" value={notfallPuffer} onChange={(e) => setNotfallPuffer(e.target.value)} />
                    <Select
                        label="Reminder vor Termin"
                        value={reminder}
                        options={[
                            { value: "0", label: "Kein Reminder" },
                            { value: "2", label: "2 Stunden vorher" },
                            { value: "24", label: "24 Stunden vorher" },
                            { value: "48", label: "48 Stunden vorher" },
                        ]}
                        onChange={(e) => setReminder(e.target.value)}
                    />
                    <Select
                        label="No-Show Behandlung"
                        value={noShow}
                        options={[
                            { value: "warn", label: "Nur markieren" },
                            { value: "fee", label: "Ausfallhinweis in Finanzen" },
                            { value: "block", label: "Patient intern kennzeichnen" },
                        ]}
                        onChange={(e) => setNoShow(e.target.value)}
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
