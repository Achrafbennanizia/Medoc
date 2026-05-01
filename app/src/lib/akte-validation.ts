/**
 * Akte-Validierung (Doktor bestätigt vom Empfang erfasste Daten).
 *
 * Stammdaten und Anamnese werden gemeinsam in einem Schritt bestätigt (UI nur unter Stammdaten).
 * Listen: je Eintrag nur für Anlagen und Zahlungen; Untersuchungen/Behandlungen/Rezepte sind Akte-inhärent und werden nicht separat „validiert“.
 */

export const VALIDATION_SECTIONS = ["stamm", "anam", "anlage", "zahl"] as const;
export type ValidationSection = (typeof VALIDATION_SECTIONS)[number];

export const SECTION_LABEL: Record<ValidationSection, string> = {
    stamm: "Stammdaten",
    anam: "Anamnese",
    anlage: "Anlagen",
    zahl: "Kundenleistungen & Abrechnung",
};

export interface ValidationRecord {
    validatedAt: string;
    by?: string;
}

/** Nur noch für Stammdaten + Anamnese (Sektion). */
export type ValidationState = Partial<Record<ValidationSection, ValidationRecord>>;

export type ItemValidationKey =
    | `unter:${string}`
    | `bh:${string}`
    | `zahl:${string}`
    | `anl:${string}`
    | `rx:${string}`;

type StoredValidationV2 = {
    version: 2;
    sections: ValidationState;
    items: Partial<Record<string, ValidationRecord>>;
};

const STORAGE_PREFIX = "medoc.akte.validation.v1.";

function key(patientId: string): string {
    return `${STORAGE_PREFIX}${patientId}`;
}

/** Art. 17 UI-cache: remove alongside backend erasure / patient delete. */
export function clearValidationStorageForPatient(patientId: string): void {
    if (!patientId) return;
    try {
        window.localStorage.removeItem(key(patientId));
    } catch {
        /* ignore */
    }
}

function parseStored(raw: string | null): StoredValidationV2 {
    if (!raw) return { version: 2, sections: {}, items: {} };
    try {
        const j = JSON.parse(raw) as unknown;
        if (j && typeof j === "object" && (j as StoredValidationV2).version === 2) {
            const v2 = j as StoredValidationV2;
            return {
                version: 2,
                sections: v2.sections && typeof v2.sections === "object" ? v2.sections : {},
                items: v2.items && typeof v2.items === "object" ? v2.items : {},
            };
        }
        if (j && typeof j === "object") {
            return { version: 2, sections: j as ValidationState, items: {} };
        }
    } catch {
        /* ignore */
    }
    return { version: 2, sections: {}, items: {} };
}

export function loadValidation(patientId: string): ValidationState {
    if (!patientId) return {};
    return parseStored(window.localStorage.getItem(key(patientId))).sections;
}

export function loadItemValidationMap(patientId: string): Partial<Record<string, ValidationRecord>> {
    if (!patientId) return {};
    return { ...parseStored(window.localStorage.getItem(key(patientId))).items };
}

function saveFull(patientId: string, data: StoredValidationV2): void {
    if (!patientId) return;
    try {
        window.localStorage.setItem(key(patientId), JSON.stringify(data));
    } catch {
        /* ignore */
    }
}

export function saveValidation(patientId: string, state: ValidationState): void {
    if (!patientId) return;
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    saveFull(patientId, { ...cur, sections: state });
}

export function setSectionValidated(
    patientId: string,
    section: ValidationSection,
    by?: string,
): ValidationState {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const nextSections: ValidationState = {
        ...cur.sections,
        [section]: { validatedAt: new Date().toISOString(), by },
    };
    saveFull(patientId, { ...cur, sections: nextSections });
    return nextSections;
}

export function clearSectionValidation(
    patientId: string,
    section: ValidationSection,
): ValidationState {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const nextSections: ValidationState = { ...cur.sections };
    delete nextSections[section];
    saveFull(patientId, { ...cur, sections: nextSections });
    return nextSections;
}

/** Ein Klick „Validieren“ unter Stammdaten setzt dieselbe Prüfung für die Anamnese. */
export function setStammAndAnamValidated(patientId: string, by?: string): ValidationState {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const at = new Date().toISOString();
    const rec: ValidationRecord = { validatedAt: at, by };
    const nextSections: ValidationState = {
        ...cur.sections,
        stamm: rec,
        anam: rec,
    };
    saveFull(patientId, { ...cur, sections: nextSections });
    return nextSections;
}

export function clearStammAndAnamValidation(patientId: string): ValidationState {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const nextSections: ValidationState = { ...cur.sections };
    delete nextSections.stamm;
    delete nextSections.anam;
    saveFull(patientId, { ...cur, sections: nextSections });
    return nextSections;
}

export function setItemValidated(
    patientId: string,
    itemKey: string,
    by?: string,
): Partial<Record<string, ValidationRecord>> {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const nextItems = {
        ...cur.items,
        [itemKey]: { validatedAt: new Date().toISOString(), by },
    };
    saveFull(patientId, { ...cur, items: nextItems });
    return nextItems;
}

export function clearItemValidation(
    patientId: string,
    itemKey: string,
): Partial<Record<string, ValidationRecord>> {
    const cur = parseStored(window.localStorage.getItem(key(patientId)));
    const nextItems = { ...cur.items };
    delete nextItems[itemKey];
    saveFull(patientId, { ...cur, items: nextItems });
    return nextItems;
}

/** Badge: Sektionen stamm/anam + aggregierte Listen (anlage/zahl) über fehlende Item-Validierungen. */
export function pendingSections(
    state: ValidationState,
    hasData: Record<ValidationSection, boolean>,
): ValidationSection[] {
    return VALIDATION_SECTIONS.filter((s) => hasData[s] && !state[s]);
}

export function itemValidationKey(
    kind: "unter" | "bh" | "zahl" | "anl" | "rx",
    id: string,
): ItemValidationKey {
    return `${kind}:${id}`;
}
