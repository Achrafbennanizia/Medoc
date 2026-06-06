/** Leerer Bogen (wird bei neuer Akte angelegt / im UI als Startpunkt genutzt). */
export const EMPTY_ANAMNESE_V1_JSON = JSON.stringify(
    { version: 1, vorerkrankungen: {}, medikation: {}, allergien: {} },
    null,
    2,
);

export type AnamneseV1 = {
    version?: number;
    versicherungsstatus?: string;
    krankenkasse?: string;
    vorerkrankungen?: Record<string, string>;
    medikation?: Record<string, string>;
    allergien?: Record<string, string>;
};

export const ANAMNESE_SECTION_LABELS: Record<string, string> = {
    versicherungsstatus: "Versicherungsstatus",
    krankenkasse: "Krankenkasse / Versicherer",
    chronisch: "Chronische Erkrankungen",
    frueherDiagnosen: "Frühere Diagnosen",
    operationen: "Operationen",
    krankenhaus: "Krankenhausaufenthalte",
    psychisch: "Psychische Vorgeschichte",
    regelmaessig: "Regelmäßige Medikation",
    einnahme: "Einnahmeschema",
    selbst: "Selbstmedikation / Nahrungsergänzung",
    vergessen: "Vergessene Einnahmen",
    nebenwirkungen: "Nebenwirkungen",
    medikamente: "Medikamentenallergien",
    lebensmittel: "Lebensmittelallergien",
    sonstige: "Sonstige Allergien",
    material: "Materialunverträglichkeiten",
    impfreaktionen: "Impfreaktionen",
};

export function anamneseLabelFor(key: string): string {
    return ANAMNESE_SECTION_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Merges Schnellerfassung fields into stored JSON before save. */
export function mergeQuickIntoAnamneseJson(
    baseJson: string,
    q: { versicherungsstatus: string; krankenkasse: string; chronisch: string; allergienMed: string },
): string {
    let root: Record<string, unknown> = {};
    try {
        root = JSON.parse(baseJson || "{}") as Record<string, unknown>;
    } catch {
        root = {};
    }
    if (root.version == null) root.version = 1;
    root.versicherungsstatus = q.versicherungsstatus.trim() || null;
    root.krankenkasse = q.krankenkasse.trim() || null;
    const vor = { ...((root.vorerkrankungen as Record<string, string>) || {}) };
    vor.chronisch = q.chronisch.trim();
    root.vorerkrankungen = vor;
    const al = { ...((root.allergien as Record<string, string>) || {}) };
    al.medikamente = q.allergienMed.trim();
    root.allergien = al;
    return JSON.stringify(root, null, 2);
}

/** Try to parse stored anamnese JSON; returns structured v1 object or null. */
export function parseAnamneseV1(json: string): AnamneseV1 | null {
    try {
        const raw = JSON.parse(json || "{}") as unknown;
        if (!raw || typeof raw !== "object") return null;
        const o = raw as Record<string, unknown>;
        if (o.version === 1 || o.versicherungsstatus != null || o.krankenkasse != null || o.allergien != null) {
            return raw as AnamneseV1;
        }
        return null;
    } catch {
        return null;
    }
}

/** Kurzzeile für Stammdaten-Karte (z. B. Versicherung + Risiko). */
export function anamneseSummaryLine(v1: AnamneseV1 | null): string | null {
    if (!v1) return null;
    const bits: string[] = [];
    if (v1.versicherungsstatus) bits.push(v1.versicherungsstatus);
    if (v1.krankenkasse) bits.push(v1.krankenkasse);
    const al = v1.allergien;
    if (al && typeof al === "object") {
        const meds = al.medikamente?.trim();
        const food = al.lebensmittel?.trim();
        const risk = [meds, food].filter(Boolean).join(", ");
        if (risk) bits.push(`Allergien: ${risk}`);
    }
    return bits.length ? bits.join(" · ") : null;
}
