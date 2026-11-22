/**
 * Single source of truth for medication suggestions used across the app
 * (template editor, patient chart, prescription page).
 *
 * Kept intentionally lightweight: the underlying domain is free-text, but a
 * curated list of frequently used dental medications drives the dropdown /
 * datalist suggestions so users can compose a combination prescription quickly
 * without typos.
 *
 * Note for production: this list is intended as a small demonstrator,
 * not a complete drug database — dosages are free text without validation.
 */
import { medicationSuggestions } from "./medication-catalog";

export interface MedicationSuggestion {
    label: string;
    /** Optional active substance prefilled when the user picks the suggestion. */
    active_ingredient?: string;
    /** Suggested daily schedule (e.g. "1-0-1") prefilled when picked. */
    dosage?: string;
    /** Treatment duration (e.g. "5 days") prefilled when picked. */
    duration?: string;
    /** Intake instructions prefilled when picked. */
    instructions?: string;
}

/** The practice's predefined medication with this exact name (case-insensitive), if any. */
export function findSuggestion(label: string): MedicationSuggestion | undefined {
    const norm = label.trim().toLowerCase();
    if (!norm) return undefined;
    return medicationSuggestions().find((s) => s.label.toLowerCase() === norm);
}

/** Item used in the cascading "combo" UI for a single Prescription-line. */
export const DOSAGE_FORM_OPTIONS = [
    "Tablets",
    "Capsules",
    "Drops",
    "Ointment",
    "Gel",
    "Spray",
    "Solution",
    "Suppository",
] as const;

export const PACK_SIZE_OPTIONS = ["N1", "N2", "N3", "Other"] as const;

export const PRESCRIPTION_KIND_OPTIONS = [
    { value: "PRIVAT", labelKey: "prescription.kind.PRIVAT" },
    { value: "KASSE", labelKey: "prescription.kind.KASSE" },
    { value: "BTM", labelKey: "prescription.kind.BTM" },
] as const;

/** Common dental ICD-10 codes (selection). */
export const DENTAL_ICD10_SUGGESTIONS = [
    "K02.1 — Dentin caries",
    "K04.0 — Pulpitis",
    "K05.0 — Acute gingivitis",
    "K05.3 — Chronic periodontitis",
    "K08.1 — Loss of teeth due to accident",
    "K10.2 — Inflammatory conditions of the jaws",
    "K12.0 — Aphthae",
    "S02.5 — Fracture of the dental arch",
] as const;

export interface PrescriptionLine {
    medication: string;
    active_ingredient: string;
    dosage: string;
    duration: string;
    instructions: string;
    pzn: string;
    dosage_form: string;
    pack_size: string;
    quantity: string;
    aut_idem: boolean;
    prescription_type: "PRIVAT" | "KASSE" | "BTM";
    icd10_code: string;
}

export const emptyPrescriptionLine = (): PrescriptionLine => ({
    medication: "",
    active_ingredient: "",
    dosage: "",
    duration: "",
    instructions: "",
    pzn: "",
    dosage_form: "",
    pack_size: "",
    quantity: "",
    aut_idem: true,
    prescription_type: "PRIVAT",
    icd10_code: "",
});

/**
 * Shape stored inside a `DocumentTemplate.payload` of `kind === "PRESCRIPTION"`
 * (set in `template-editor.tsx`). Older templates may be missing fields.
 */
export interface TemplatePrescriptionItem {
    medication: string;
    /** Active substance; compared with the patient's allergies before issuing. */
    active_ingredient?: string;
    dosage?: string;
    /** Treatment duration / intake duration (template editor may add later). */
    duration?: string;
    description?: string;
}

/**
 * Convert items as stored in a Prescription-Template into the `PrescriptionLine` shape
 * used by the cascading "combo" dialogs. Fields the template leaves empty come from the
 * practice's predefined medication of the same name; nothing is invented, so a line that is
 * still incomplete is reported by `buildPrescriptionQueue` before issuing.
 */
export function templateItemsToLines(items: TemplatePrescriptionItem[]): PrescriptionLine[] {
    if (!Array.isArray(items)) return [];
    return items
        .filter((it) => it && typeof it.medication === "string" && it.medication.trim().length > 0)
        .map((it) => {
            const sugg = findSuggestion(it.medication);
            const durationRaw = (it.duration ?? sugg?.duration ?? "").trim();
            return {
                ...emptyPrescriptionLine(),
                medication: it.medication.trim(),
                active_ingredient: (it.active_ingredient ?? sugg?.active_ingredient ?? "").trim(),
                dosage: (it.dosage ?? sugg?.dosage ?? "").trim(),
                duration: durationRaw,
                instructions: (it.description ?? sugg?.instructions ?? "").trim(),
            };
        });
}

/**
 * Safely extract `payload.items` from a `DocumentTemplate` of kind PRESCRIPTION.
 * The payload is stored as JSON string in the backend.
 */
export function parsePrescriptionTemplatePayload(payload: string): TemplatePrescriptionItem[] {
    try {
        const obj = JSON.parse(payload) as { items?: unknown };
        if (!obj || !Array.isArray(obj.items)) return [];
        return obj.items as TemplatePrescriptionItem[];
    } catch {
        return [];
    }
}

/** Persist composer lines as a new `DocumentTemplate` payload (`items`). */
export function prescriptionLinesToTemplateItems(lines: PrescriptionLine[]): TemplatePrescriptionItem[] {
    return lines
        .filter((l) => l.medication.trim().length > 0)
        .map((l) => ({
            medication: l.medication.trim(),
            active_ingredient: l.active_ingredient.trim() || undefined,
            dosage: l.dosage.trim() || undefined,
            duration: l.duration.trim() || undefined,
            description: l.instructions.trim() || undefined,
        }));
}
