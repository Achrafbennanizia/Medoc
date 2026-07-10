import type { Produkt } from "@/models/types";

export type ProduktForm = {
    name: string;
    kategorie: string;
    preis: string;
    bestand: string;
    mindestbestand: string;
    beschreibung: string;
    /** Order master data — optional link when creating a product. */
    lieferantId: string;
    pharmaberaterId: string;
};

export function emptyForm(): ProduktForm {
    return {
        name: "",
        kategorie: "",
        preis: "",
        bestand: "",
        mindestbestand: "",
        beschreibung: "",
        lieferantId: "",
        pharmaberaterId: "",
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
        lieferantId: "",
        pharmaberaterId: "",
    };
}

export function hasStammLinkSelection(f: ProduktForm): boolean {
    return Boolean(f.lieferantId.trim() && f.pharmaberaterId.trim());
}

export function parseForm(
    f: ProduktForm,
    opts?: { stockUi?: boolean; stockFallback?: Pick<Produkt, "bestand" | "mindestbestand"> },
): {
    name: string;
    kategorie: string;
    preis: number;
    bestand: number;
    mindestbestand: number;
    beschreibung: string | undefined;
} {
    const stockUi = opts?.stockUi !== false;
    const fallback = opts?.stockFallback;
    const amount = Math.trunc(Number(f.bestand));
    return {
        name: f.name.trim(),
        kategorie: f.kategorie.trim(),
        preis: Number(String(f.preis).replace(",", ".")),
        bestand: amount,
        mindestbestand: stockUi ? Math.trunc(Number(f.mindestbestand)) : (fallback?.mindestbestand ?? 0),
        beschreibung: f.beschreibung.trim() || undefined,
    };
}

export function formValid(f: ProduktForm, opts?: { stockUi?: boolean }): boolean {
    if (!f.name.trim() || !f.kategorie.trim()) return false;
    const preis = Number(String(f.preis).replace(",", "."));
    if (!Number.isFinite(preis) || preis < 0) return false;
    if (opts?.stockUi !== false) {
        if (!Number.isFinite(Number(f.bestand)) || !Number.isFinite(Number(f.mindestbestand))) return false;
    } else {
        const amount = Number(f.bestand);
        if (!Number.isFinite(amount) || amount < 0) return false;
    }
    return true;
}
