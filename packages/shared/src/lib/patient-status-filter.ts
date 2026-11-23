/**
 * Patient list status tabs (Patient records).
 * Keep in sync with `patient_repo::tab_condition` (the list and tab counts filter in SQL).
 */

export type PatientStatusFilter =
    | "ALL"
    | "IN_TREATMENT"
    | "NEW_PATIENT"
    | "INVOICE_OPEN"
    | "CHART_OPEN"
    | "CLOSED";

/**
 * Patient list rules (must match `patient_repo::filter_counts`):
 * - lifecycle, exactly one per patient: NEW_PATIENT (NEW) · IN_TREATMENT (ACTIVE) · CLOSED (VALIDATED/READONLY)
 * - attention flags, may overlap: INVOICE_OPEN (unpaid payment) · CHART_OPEN (record draft / in review / declined)
 */
export function patientMatchesStatusFilter(
    patient: { id: string; status: string },
    filter: PatientStatusFilter,
    openInvoicePatientIds: ReadonlySet<string>,
    openChartPatientIds: ReadonlySet<string> = new Set(),
): boolean {
    const status = patient.status;
    switch (filter) {
        case "ALL":
            return true;
        case "NEW_PATIENT":
            return status === "NEW";
        case "IN_TREATMENT":
            return status === "ACTIVE";
        case "CLOSED":
            return status === "VALIDATED" || status === "READONLY";
        case "INVOICE_OPEN":
            return openInvoicePatientIds.has(patient.id);
        case "CHART_OPEN":
            return openChartPatientIds.has(patient.id);
        default:
            return true;
    }
}
