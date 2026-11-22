/** First problem with a prescription line (medication, dosage, duration), or null when it is complete. */
import type { PrescriptionLine } from "./medications";

export function validatePrescriptionLine(line: PrescriptionLine, t: (key: string) => string): string | null {
    if (!line.medication.trim()) return t("page.prescriptions.validation.med_required");
    if (!line.dosage.trim()) return t("page.prescriptions.validation.dosage_required");
    if (!line.duration.trim()) return t("page.prescriptions.validation.duration_required");
    return null;
}
