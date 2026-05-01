/**
 * Patient-scoped browser storage cleared on Art. 17 erasure and full patient delete.
 * Backend SQLite is authoritative; these keys are UX caches only.
 */

import { clearValidationStorageForPatient } from "./akte-validation";
import { clearPlanNextTerminStorageForPatient } from "./plan-next-termin";
import { removeInvoiceHistoryForPatient } from "./invoice-history";

export function clearPatientScopedBrowserStorage(patientId: string): void {
    const id = patientId.trim();
    if (!id) return;
    clearValidationStorageForPatient(id);
    clearPlanNextTerminStorageForPatient(id);
    removeInvoiceHistoryForPatient(id);
}
