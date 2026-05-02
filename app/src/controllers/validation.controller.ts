import { tauriInvoke } from "@/services/tauri.service";
import {
    VALIDATION_SECTIONS,
    type ValidationSection,
    type ValidationState,
    type ValidationRecord,
} from "@/lib/akte-validation";

/** Row mirrors Rust `AkteValidationRowDto`. */
export type AkteValidationRow = {
    patient_id: string;
    section_or_item: string;
    validated_at: string;
    validated_by: string | null;
};

const LEGACY_LS_PREFIX = "medoc.akte.validation.v1.";

function legacyKey(patientId: string): string {
    return `${LEGACY_LS_PREFIX}${patientId}`;
}

export function rowsToValidationMaps(rows: AkteValidationRow[]): {
    sections: ValidationState;
    items: Partial<Record<string, ValidationRecord>>;
} {
    const sections: ValidationState = {};
    const items: Partial<Record<string, ValidationRecord>> = {};
    const sectionSet = new Set<string>(VALIDATION_SECTIONS as unknown as string[]);
    for (const r of rows) {
        const rec: ValidationRecord = {
            validatedAt: r.validated_at,
            by: r.validated_by ?? undefined,
        };
        if (sectionSet.has(r.section_or_item)) {
            sections[r.section_or_item as ValidationSection] = rec;
        } else {
            items[r.section_or_item] = rec;
        }
    }
    return { sections, items };
}

export async function listAkteValidation(patientId: string): Promise<AkteValidationRow[]> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) return [];
    return tauriInvoke<AkteValidationRow[]>("list_akte_validation", { patientId: pid });
}

export async function setAkteSectionValidated(
    patientId: string,
    section: ValidationSection,
    validatedBy?: string | null,
): Promise<void> {
    await tauriInvoke<void>("set_akte_section_validated", {
        patientId,
        section,
        validatedBy: validatedBy ?? null,
    });
}

export async function setAkteItemValidated(
    patientId: string,
    itemKey: string,
    validatedBy?: string | null,
): Promise<void> {
    await tauriInvoke<void>("set_akte_item_validated", {
        patientId,
        itemKey,
        validatedBy: validatedBy ?? null,
    });
}

export async function clearAkteValidation(
    patientId: string,
    sectionOrItem?: string | null,
): Promise<void> {
    await tauriInvoke<void>("clear_akte_validation", {
        patientId,
        sectionOrItem: sectionOrItem ?? null,
    });
}

type LegacyStoredV2 = {
    version: 2;
    sections: ValidationState;
    items: Partial<Record<string, ValidationRecord>>;
};

function parseLegacyLs(raw: string | null): LegacyStoredV2 | null {
    if (!raw) return null;
    try {
        const j = JSON.parse(raw) as unknown;
        if (j && typeof j === "object" && (j as LegacyStoredV2).version === 2) {
            const v2 = j as LegacyStoredV2;
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
    return null;
}

/** One-shot migration from `localStorage` into SQLite. Returns true if legacy data was imported. */
export async function migrateLegacyAkteValidationFromLocalStorage(patientId: string): Promise<boolean> {
    if (typeof window === "undefined" || !patientId) return false;
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(legacyKey(patientId));
    } catch {
        return false;
    }
    const parsed = parseLegacyLs(raw);
    if (!parsed) return false;

    const sections = parsed.sections ?? {};
    const entries = Object.entries(sections) as [ValidationSection, ValidationRecord][];
    const hasSections = entries.length > 0;
    const itemEntries = Object.entries(parsed.items ?? {});
    const hasItems = itemEntries.length > 0;
    if (!hasSections && !hasItems) {
        try {
            window.localStorage.removeItem(legacyKey(patientId));
        } catch {
            /* ignore */
        }
        return false;
    }

    for (const [sec, rec] of entries) {
        if (!rec || !(VALIDATION_SECTIONS as readonly string[]).includes(sec)) continue;
        await setAkteSectionValidated(patientId, sec, rec.by);
    }
    for (const [itemKey, rec] of itemEntries) {
        if (!rec) continue;
        await setAkteItemValidated(patientId, itemKey, rec.by);
    }
    try {
        window.localStorage.removeItem(legacyKey(patientId));
    } catch {
        /* ignore */
    }
    return true;
}

export function stripLegacyAkteValidationLocalStorage(patientId: string): void {
    if (!patientId || typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(legacyKey(patientId));
    } catch {
        /* ignore */
    }
}
