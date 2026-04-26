/**
 * Single source of truth for medication suggestions used across the app
 * (Vorlagen-Editor, Patientenakte, Rezeptseite).
 *
 * Kept intentionally lightweight: the underlying domain is free-text, but a
 * curated list of frequently used dental medications drives the dropdown /
 * datalist suggestions so users can compose a "Kombinationsrezept" quickly
 * without typos.
 */
export interface MedikamentSuggestion {
    label: string;
    /** Optional active substance (Wirkstoff) prefilled when the user picks the suggestion. */
    wirkstoff?: string;
    /** Suggested daily schedule (e.g. "1-0-1") prefilled when picked. */
    dosierung?: string;
}

export const MEDIKAMENT_SUGGESTIONS: MedikamentSuggestion[] = [
    { label: "Amoxicillin 1000 mg", wirkstoff: "Amoxicillin", dosierung: "1-0-1" },
    { label: "Clindamycin 600 mg", wirkstoff: "Clindamycin", dosierung: "1-1-1" },
    { label: "Ibuprofen 400 mg", wirkstoff: "Ibuprofen", dosierung: "1-1-1" },
    { label: "Ibuprofen 600 mg", wirkstoff: "Ibuprofen", dosierung: "1-0-1" },
    { label: "Paracetamol 500 mg", wirkstoff: "Paracetamol", dosierung: "1-1-1" },
    { label: "Novaminsulfon 500 mg", wirkstoff: "Metamizol", dosierung: "1-1-1" },
    { label: "Chlorhexidin 0,2 % Mundspülung", wirkstoff: "Chlorhexidin", dosierung: "2x täglich spülen" },
    { label: "Dexamethason 4 mg", wirkstoff: "Dexamethason", dosierung: "1-0-0" },
    { label: "Metronidazol 400 mg", wirkstoff: "Metronidazol", dosierung: "1-1-1" },
    { label: "Pantoprazol 20 mg", wirkstoff: "Pantoprazol", dosierung: "1-0-0" },
];

export function findSuggestion(label: string): MedikamentSuggestion | undefined {
    const norm = label.trim().toLowerCase();
    if (!norm) return undefined;
    return MEDIKAMENT_SUGGESTIONS.find((s) => s.label.toLowerCase() === norm);
}

/** Item used in the cascading "combo" UI for a single Rezept-line. */
export interface RezeptLine {
    medikament: string;
    wirkstoff: string;
    dosierung: string;
    dauer: string;
    hinweise: string;
}

export const emptyRezeptLine = (): RezeptLine => ({
    medikament: "",
    wirkstoff: "",
    dosierung: "",
    dauer: "",
    hinweise: "",
});

/**
 * Shape stored inside a `DokumentVorlage.payload` of `kind === "REZEPT"`
 * (set in `vorlage-editor.tsx`). Older templates may be missing fields.
 */
export interface VorlageRezeptItem {
    medikament: string;
    dosierung?: string;
    /** Behandlungsdauer / Einnahmedauer (Vorlagen-Editor kann sie später ergänzen). */
    dauer?: string;
    beschreibung?: string;
}

/**
 * Convert items as stored in a Rezept-Vorlage into the `RezeptLine` shape
 * used by the cascading "combo" dialogs. Fills missing `wirkstoff` /
 * `dauer` from the curated suggestion list when possible.
 */
export function vorlageItemsToLines(items: VorlageRezeptItem[]): RezeptLine[] {
    if (!Array.isArray(items)) return [];
    return items
        .filter((it) => it && typeof it.medikament === "string" && it.medikament.trim().length > 0)
        .map((it) => {
            const sugg = findSuggestion(it.medikament);
            const dauerRaw = (it.dauer ?? "").trim();
            return {
                medikament: it.medikament.trim(),
                wirkstoff: sugg?.wirkstoff ?? "",
                dosierung: (it.dosierung ?? sugg?.dosierung ?? "").trim(),
                dauer: dauerRaw || "7 Tage",
                hinweise: (it.beschreibung ?? "").trim(),
            };
        });
}

/**
 * Safely extract `payload.items` from a `DokumentVorlage` of kind REZEPT.
 * The payload is stored as JSON string in the backend.
 */
export function parseRezeptVorlagePayload(payload: string): VorlageRezeptItem[] {
    try {
        const obj = JSON.parse(payload) as { items?: unknown };
        if (!obj || !Array.isArray(obj.items)) return [];
        return obj.items as VorlageRezeptItem[];
    } catch {
        return [];
    }
}

/** Persist composer lines as a new `DokumentVorlage` payload (`items`). */
export function rezeptLinesToVorlageItems(lines: RezeptLine[]): VorlageRezeptItem[] {
    return lines
        .filter((l) => l.medikament.trim().length > 0)
        .map((l) => ({
            medikament: l.medikament.trim(),
            dosierung: l.dosierung.trim() || undefined,
            dauer: l.dauer.trim() || undefined,
            beschreibung: l.hinweise.trim() || undefined,
        }));
}
