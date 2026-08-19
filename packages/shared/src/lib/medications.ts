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
export interface MedicationSuggestion {
    label: string;
    /** Optional active substance prefilled when the user picks the suggestion. */
    active_ingredient?: string;
    /** Suggested daily schedule (e.g. "1-0-1") prefilled when picked. */
    dosage?: string;
}

export const MEDICATION_SUGGESTIONS: MedicationSuggestion[] = [
    { label: "Amoxicillin 1000 mg", active_ingredient: "Amoxicillin", dosage: "1-0-1" },
    { label: "Clindamycin 600 mg", active_ingredient: "Clindamycin", dosage: "1-1-1" },
    { label: "Ibuprofen 400 mg", active_ingredient: "Ibuprofen", dosage: "1-1-1" },
    { label: "Ibuprofen 600 mg", active_ingredient: "Ibuprofen", dosage: "1-0-1" },
    { label: "Paracetamol 500 mg", active_ingredient: "Paracetamol", dosage: "1-1-1" },
    { label: "Novaminsulfon 500 mg", active_ingredient: "Metamizol", dosage: "1-1-1" },
    { label: "Chlorhexidine 0.2% mouthwash", active_ingredient: "Chlorhexidin", dosage: "Rinse twice daily" },
    { label: "Dexamethason 4 mg", active_ingredient: "Dexamethason", dosage: "1-0-0" },
    { label: "Metronidazol 400 mg", active_ingredient: "Metronidazol", dosage: "1-1-1" },
    { label: "Pantoprazol 20 mg", active_ingredient: "Pantoprazol", dosage: "1-0-0" },
];

export function findSuggestion(label: string): MedicationSuggestion | undefined {
    const norm = label.trim().toLowerCase();
    if (!norm) return undefined;
    return MEDICATION_SUGGESTIONS.find((s) => s.label.toLowerCase() === norm);
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
    { value: "PRIVAT", label: "Private" },
    { value: "KASSE", label: "Statutory" },
    { value: "BTM", label: "BtM" },
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
    dosage?: string;
    /** Treatment duration / intake duration (template editor may add later). */
    duration?: string;
    description?: string;
}

/**
 * Convert items as stored in a Prescription-Template into the `PrescriptionLine` shape
 * used by the cascading "combo" dialogs. Fills missing `active_ingredient` /
 * `duration` from the curated suggestion list when possible.
 */
export function templateItemsToLines(items: TemplatePrescriptionItem[]): PrescriptionLine[] {
    if (!Array.isArray(items)) return [];
    return items
        .filter((it) => it && typeof it.medication === "string" && it.medication.trim().length > 0)
        .map((it) => {
            const sugg = findSuggestion(it.medication);
            const durationRaw = (it.duration ?? "").trim();
            return {
                ...emptyPrescriptionLine(),
                medication: it.medication.trim(),
                active_ingredient: sugg?.active_ingredient ?? "",
                dosage: (it.dosage ?? sugg?.dosage ?? "").trim(),
                duration: durationRaw || "7 days",
                instructions: (it.description ?? "").trim(),
            };
        });
}

/**
 * Safely extract `payload.items` from a `DocumentTemplate` of kind REZEPT.
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
            dosage: l.dosage.trim() || undefined,
            duration: l.duration.trim() || undefined,
            description: l.instructions.trim() || undefined,
        }));
}
