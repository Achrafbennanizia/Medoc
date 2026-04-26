import type { Behandlung, Zahnbefund } from "@/models/types";

export const DENTAL_UPPER_R = ["18", "17", "16", "15", "14", "13", "12", "11"];
export const DENTAL_UPPER_L = ["21", "22", "23", "24", "25", "26", "27", "28"];
export const DENTAL_LOWER_R = ["48", "47", "46", "45", "44", "43", "42", "41"];
export const DENTAL_LOWER_L = ["31", "32", "33", "34", "35", "36", "37", "38"];

export const DENTAL_STATUS_KEYS = [
    "healthy",
    "karies",
    "fuellung",
    "krone",
    "wurzel",
    "fehlt",
    "implantat",
    "geplant",
] as const;

export type DentalStatusKey = (typeof DENTAL_STATUS_KEYS)[number];

export const DENTAL_STATES: Record<DentalStatusKey, { fill: string; stroke: string; label: string }> = {
    healthy: { fill: "#FFFFFF", stroke: "#C8CCD1", label: "Gesund" },
    karies: { fill: "#FFE0DD", stroke: "#E86B5E", label: "Karies" },
    fuellung: { fill: "#DCECFF", stroke: "#4A9DFF", label: "Füllung" },
    krone: { fill: "#FFF0C8", stroke: "#D9A300", label: "Krone" },
    wurzel: { fill: "#E8DCFB", stroke: "#9B6BD8", label: "Wurzel-Fx" },
    fehlt: { fill: "transparent", stroke: "#BFC3C7", label: "Fehlt" },
    implantat: { fill: "#D4F1E3", stroke: "#0EA07E", label: "Implantat" },
    geplant: { fill: "#DCF3EC", stroke: "#0EA07E", label: "Geplant" },
};

export type DentalToothShapeKey = "incisor" | "canine" | "premolar" | "molar";

export const DENTAL_TOOTH_SHAPES: Record<DentalToothShapeKey, { crown: string; root: string }> = {
    incisor: { crown: "M8 2 Q4 2 3 6 L3 14 Q3 18 10 18 Q17 18 17 14 L17 6 Q16 2 12 2 Z", root: "M5 18 Q6 28 10 30 Q14 28 15 18 Z" },
    canine: { crown: "M10 1 Q5 2 4 7 L4 14 Q4 18 10 19 Q16 18 16 14 L16 7 Q15 2 10 1 Z", root: "M6 18 Q7 30 10 32 Q13 30 14 18 Z" },
    premolar: { crown: "M6 3 Q3 4 3 8 L3 14 Q3 18 7 19 L13 19 Q17 18 17 14 L17 8 Q17 4 14 3 Q11 2 10 4 Q9 2 6 3 Z", root: "M5 18 Q6 28 10 30 Q14 28 15 18 Z" },
    molar: { crown: "M5 3 Q2 4 2 8 L2 14 Q2 18 5 19 L15 19 Q18 18 18 14 L18 8 Q18 4 15 3 Q12 3 11 4 Q10 2 9 4 Q8 3 5 3 Z", root: "M4 18 Q3 30 7 30 L13 30 Q17 30 16 18 Z" },
};

export function dentalToothType(fdi: string): DentalToothShapeKey {
    const d = +fdi[1];
    if (d <= 2) return "incisor";
    if (d === 3) return "canine";
    if (d <= 5) return "premolar";
    return "molar";
}

/** Map stored Befund text / key to visual status. */
export function befundToStatusKey(befund: string | null | undefined): DentalStatusKey {
    if (!befund) return "healthy";
    const b = befund.trim().toLowerCase();
    if (b in DENTAL_STATES) return b as DentalStatusKey;
    if (b.includes("karies")) return "karies";
    if (b.includes("füll") || b.includes("fuell")) return "fuellung";
    if (b.includes("krone")) return "krone";
    if (b.includes("wurzel") || b.includes("frakt")) return "wurzel";
    if (b.includes("fehl") || b.includes("extrah")) return "fehlt";
    if (b.includes("implant")) return "implantat";
    if (b.includes("geplant")) return "geplant";
    return "healthy";
}

/** Split zaehne field into FDI tokens (e.g. "18, 16" → ["18","16"]). */
export function parseZaehneTokens(z: string | null | undefined): string[] {
    if (!z) return [];
    return z
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

export function befundeForTooth(befunde: Zahnbefund[], fdi: string): Zahnbefund[] {
    const n = Number(fdi);
    return befunde.filter((b) => b.zahn_nummer === n);
}

export function behandlungenForTooth(behandlungen: Behandlung[], fdi: string): Behandlung[] {
    return behandlungen.filter((b) => parseZaehneTokens(b.zaehne).some((t) => t === fdi));
}
