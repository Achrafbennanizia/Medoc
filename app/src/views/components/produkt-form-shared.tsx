import { useId } from "react";
import type { Produkt } from "@/models/types";
import { Input, Textarea } from "./ui/input";

export type ProduktForm = {
    name: string;
    kategorie: string;
    preis: string;
    bestand: string;
    mindestbestand: string;
    beschreibung: string;
};

export function emptyForm(): ProduktForm {
    return {
        name: "",
        kategorie: "",
        preis: "",
        bestand: "",
        mindestbestand: "",
        beschreibung: "",
    };
}

export function toForm(p: Produkt): ProduktForm {
    return {
        name: p.name,
        kategorie: p.kategorie,
        preis: String(p.preis),
        bestand: String(p.bestand),
        mindestbestand: String(p.mindestbestand),
        beschreibung: p.beschreibung ?? "",
    };
}

export function parseForm(f: ProduktForm): {
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

export function formValid(f: ProduktForm): boolean {
    if (!f.name.trim() || !f.kategorie.trim()) return false;
    const preis = Number(String(f.preis).replace(",", "."));
    if (!Number.isFinite(preis) || preis < 0) return false;
    if (!Number.isFinite(Number(f.bestand)) || !Number.isFinite(Number(f.mindestbestand))) return false;
    return true;
}

export function ProduktFormFields({
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
