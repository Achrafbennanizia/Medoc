/**
 * Patient-scoped **legacy** browser keys cleared on Art. 17 erasure and full patient delete.
 * Authoritative data lives in SQLite (`chart_validation`, `chart_next_appointment_hint`, `invoice_document`,
 * `app_kv` appointment drafts via `appointment.draft.v1.{uuid}`, …).
 */

import { stripLegacyChartValidationLocalStorage } from "@/systems/practice-host/controllers/validation.controller";
import { stripLegacyPlanNextAppointmentLocalStorage } from "@/systems/practice-host/controllers/plan-next-appointment.controller";
import { stripLegacyInvoiceHistoryLocalStorage } from "@/systems/practice-host/controllers/invoice-document.controller";

export function clearPatientScopedBrowserStorage(patientId: string): void {
    const id = patientId.trim();
    if (!id) return;
    stripLegacyChartValidationLocalStorage(id);
    stripLegacyPlanNextAppointmentLocalStorage(id);
    stripLegacyInvoiceHistoryLocalStorage();
}
