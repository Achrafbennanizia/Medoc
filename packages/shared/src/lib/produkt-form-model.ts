import type { Produkt } from "@/models/types";

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
