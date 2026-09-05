/**
 * FA-LEIST-06 — mirrors `pricing::treatment_has_billable_service_item` + patient-detail UX.
 */

/** FA-LEIST-06/07 — same rule for Treatment and Examination. */
export function treatmentHasBillableServiceItem(
    service_name: string | null | undefined,
    total_cost: number | null | undefined,
): boolean {
    if ((service_name ?? "").trim().length > 0) return true;
    const g = total_cost;
    return g != null && Number.isFinite(g) && g > 0.005;
}

export const examinationHasBillableServiceItem = treatmentHasBillableServiceItem;

/** FA-LEIST-05 — physician billing release recorded on Treatment / Examination rows. */
export function isReleasedForBilling(entry: {
    released_by_physician_id?: string | null;
    released_at?: string | null;
}): boolean {
    const by = entry.released_by_physician_id;
    const at = entry.released_at;
    return Boolean(by) && (at ?? "").trim() !== "";
}
