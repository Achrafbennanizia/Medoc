/**
 * Patient list status tabs (Patient records).
 * Keep in sync with `count_patients_by_filter` / `PatientFilterCounts`.
 */

export type PatientStatusFilter =
    | "ALL"
    | "IN_TREATMENT"
    | "NEW_PATIENT"
    | "INVOICE_OPEN"
    | "CHART_OPEN"
    | "CLOSED";

/** Tabs that cannot be expressed as a single `patient.status` server filter. */
export function patientStatusFilterNeedsClientBucket(filter: PatientStatusFilter): boolean {
    return (
        filter === "IN_TREATMENT" ||
        filter === "INVOICE_OPEN" ||
        filter === "CHART_OPEN" ||
        filter === "CLOSED"
    );
}

/** Optional single-status hint for paged server queries (NEW only today). */
export function patientStatusFilterServerStatus(
    filter: PatientStatusFilter,
): string | undefined {
    if (filter === "NEW_PATIENT") return "NEW";
    return undefined;
}

export function patientMatchesStatusFilter(
    patient: { id: string; status: string },
    filter: PatientStatusFilter,
    openInvoicePatientIds: ReadonlySet<string>,
): boolean {
    if (filter === "ALL") return true;
    const inv = openInvoicePatientIds.has(patient.id);
    const status = patient.status;
    if (filter === "IN_TREATMENT") return (status === "ACTIVE" || status === "VALIDATED") && !inv;
    if (filter === "NEW_PATIENT") return status === "NEW";
    if (filter === "INVOICE_OPEN") return inv;
    if (filter === "CHART_OPEN") return status === "NEW" && !inv;
    if (filter === "CLOSED") return status === "VALIDATED" || status === "READONLY";
    return true;
}
