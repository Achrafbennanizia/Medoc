/** Built-in predefined medications: what a practice starts with before saving its own list. */
import type { MedicationSuggestion } from "./medications";

export const BUILT_IN_MEDICATIONS: readonly MedicationSuggestion[] = [
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

