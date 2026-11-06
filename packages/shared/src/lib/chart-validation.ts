/**
 * Patient-record validation (physician confirms reception-captured data).
 *
 * Persistence: SQLite `chart_validation` via `validation.controller.ts`.
 */

export const VALIDATION_SECTIONS = ["master", "anamnesis", "attachment", "payment"] as const;
export type ValidationSection = (typeof VALIDATION_SECTIONS)[number];

export const SECTION_LABEL_KEY: Record<ValidationSection, string> = {
    master: "patient.validation.section.master",
    anamnesis: "patient.validation.section.anamnesis",
    attachment: "patient.validation.section.attachment",
    payment: "patient.validation.section.payment",
};

export interface ValidationRecord {
    validatedAt: string;
    by?: string;
}

/** Only for master data + anamnesis (section). */
export type ValidationState = Partial<Record<ValidationSection, ValidationRecord>>;

export type ItemValidationKey =
    | `examination:${string}`
    | `treatment:${string}`
    | `payment:${string}`
    | `attachment:${string}`
    | `rx:${string}`;

/** Badge: master/anam sections + aggregated lists (attachment/payment) over missing item validations. */
export function pendingSections(
    state: ValidationState,
    hasData: Record<ValidationSection, boolean>,
): ValidationSection[] {
    return VALIDATION_SECTIONS.filter((s) => hasData[s] && !state[s]);
}

export function itemValidationKey(
    kind: "examination" | "treatment" | "payment" | "attachment" | "rx",
    id: string,
): ItemValidationKey {
    return `${kind}:${id}`;
}
