/**
 * Patient-record validation (physician confirms reception-captured data).
 *
 * Persistence: SQLite `chart_validation` via `validation.controller.ts`.
 */

export const VALIDATION_SECTIONS = ["master", "anamnesis", "attachment", "payment"] as const;
export type ValidationSection = (typeof VALIDATION_SECTIONS)[number];

export const SECTION_LABEL: Record<ValidationSection, string> = {
    master: "Master data",
    anam: "Medical history",
    attachment: "Attachments",
    payment: "Customer services & billing",
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
    | `payment:${string}`
    | `anl:${string}`
    | `rx:${string}`;

/** Badge: master/anam sections + aggregated lists (attachment/payment) over missing item validations. */
export function pendingSections(
    state: ValidationState,
    hasData: Record<ValidationSection, boolean>,
): ValidationSection[] {
    return VALIDATION_SECTIONS.filter((s) => hasData[s] && !state[s]);
}

export function itemValidationKey(
    kind: "examination" | "bh" | "payment" | "anl" | "rx",
    id: string,
): ItemValidationKey {
    return `${kind}:${id}`;
}
