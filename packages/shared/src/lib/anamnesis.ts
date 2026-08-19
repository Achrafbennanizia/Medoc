/** Empty form (created with a new patient chart / used as UI starting point). */
export const EMPTY_ANAMNESIS_V1_JSON = JSON.stringify(
    { version: 1, preExisting: {}, medication: {}, allergies: {} },
    null,
    2,
);

export type AnamnesisV1 = {
    version?: number;
    insuranceStatus?: string;
    health_insurance?: string;
    preExisting?: Record<string, string>;
    medication?: Record<string, string>;
    allergies?: Record<string, string>;
};

export const ANAMNESIS_SECTION_LABELS: Record<string, string> = {
    insuranceStatus: "Insurance status",
    health_insurance: "Health insurer",
    chronic: "Chronic conditions",
    previousDiagnoses: "Previous diagnoses",
    surgeries: "Surgeries",
    hospital: "Hospital stays",
    mental: "Mental health history",
    regular: "Regular medication",
    dosing: "Dosing schedule",
    selbst: "Self-medication / supplements",
    missed: "Missed doses",
    sideEffects: "Side effects",
    medications: "Drug allergies",
    foods: "Food allergies",
    other: "Other allergies",
    material: "Material intolerances",
    vaccineReactions: "Vaccine reactions",
};

export function anamnesisLabelFor(key: string, t?: (key: string) => string): string {
    if (t) {
        const i18nKey = `anamnesis.field.${key}`;
        const translated = t(i18nKey);
        if (translated !== i18nKey) return translated;
    }
    return ANAMNESIS_SECTION_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Merges quick-capture fields into stored JSON before save. */
export function mergeQuickIntoAnamnesisJson(
    baseJson: string,
    q: { insuranceStatus: string; health_insurance: string; chronic: string; allergiesMed: string },
): string {
    let root: Record<string, unknown> = {};
    try {
        root = JSON.parse(baseJson || "{}") as Record<string, unknown>;
    } catch {
        root = {};
    }
    if (root.version == null) root.version = 1;
    root.insuranceStatus = q.insuranceStatus.trim() || null;
    root.health_insurance = q.health_insurance.trim() || null;
    const vor = { ...((root.preExisting as Record<string, string>) || {}) };
    vor.chronic = q.chronic.trim();
    root.preExisting = vor;
    const al = { ...((root.allergies as Record<string, string>) || {}) };
    al.medications = q.allergiesMed.trim();
    root.allergies = al;
    return JSON.stringify(root, null, 2);
}

/** Try to parse stored anamnesis JSON; returns structured v1 object or null. */
export function parseAnamnesisV1(json: string): AnamnesisV1 | null {
    try {
        const raw = JSON.parse(json || "{}") as unknown;
        if (!raw || typeof raw !== "object") return null;
        const o = raw as Record<string, unknown>;
        if (o.version === 1 || o.insuranceStatus != null || o.health_insurance != null || o.allergies != null) {
            return raw as AnamnesisV1;
        }
        return null;
    } catch {
        return null;
    }
}

/** Short line for master data card (e.g. insurance + risk). */
export function anamnesisSummaryLine(v1: AnamnesisV1 | null): string | null {
    if (!v1) return null;
    const bits: string[] = [];
    if (v1.insuranceStatus) bits.push(v1.insuranceStatus);
    if (v1.health_insurance) bits.push(v1.health_insurance);
    const al = v1.allergies;
    if (al && typeof al === "object") {
        const meds = al.medications?.trim();
        const food = al.foods?.trim();
        const risk = [meds, food].filter(Boolean).join(", ");
        if (risk) bits.push(`Allergies: ${risk}`);
    }
    return bits.length ? bits.join(" · ") : null;
}
