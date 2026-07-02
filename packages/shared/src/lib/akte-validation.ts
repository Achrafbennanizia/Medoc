/**
 * Akte validation (physician confirms reception-captured data).
 *
 * Persistenz: SQLite `akte_validation` via `validation.controller.ts`.
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

/** Only for master data + anamnesis (section). */
export type ValidationState = Partial<Record<ValidationSection, ValidationRecord>>;

export type ItemValidationKey =
    | `unter:${string}`
    | `bh:${string}`
    | `zahl:${string}`
    | `anl:${string}`
    | `rx:${string}`;

/** Badge: stamm/anam sections + aggregated lists (anlage/zahl) over missing item validations. */
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
