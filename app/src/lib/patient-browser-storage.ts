/**
 * Patient-scoped **legacy** browser keys cleared on Art. 17 erasure and full patient delete.
 * Authoritative data lives in SQLite (`akte_validation`, `akte_next_termin_hint`, `rechnung_document`, …).
 */

import { stripLegacyAkteValidationLocalStorage } from "@/controllers/validation.controller";
import { stripLegacyPlanNextTerminLocalStorage } from "@/controllers/plan-next-termin.controller";
import { stripLegacyInvoiceHistoryLocalStorage } from "@/controllers/rechnung-document.controller";

export function clearPatientScopedBrowserStorage(patientId: string): void {
    const id = patientId.trim();
    if (!id) return;
    stripLegacyAkteValidationLocalStorage(id);
    stripLegacyPlanNextTerminLocalStorage(id);
    stripLegacyInvoiceHistoryLocalStorage();
}
