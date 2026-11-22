/**
 * A prescription line after the doctor typed or picked `label` as medication. When it names a
 * predefined medication, its active substance, dosage, duration and instructions fill the
 * fields the doctor left empty.
 */
import { findSuggestion, type PrescriptionLine } from "./medications";

export function applyMedicationSuggestion(line: PrescriptionLine, label: string): PrescriptionLine {
    const s = findSuggestion(label);
    return {
        ...line,
        medication: label,
        active_ingredient: line.active_ingredient || s?.active_ingredient || "",
        dosage: line.dosage || s?.dosage || "",
        duration: line.duration || s?.duration || "",
        instructions: line.instructions || s?.instructions || "",
    };
}
