/**
 * FA-LEIST-06 — UI hint for a billable treatment or examination line.
 * A cost counts when it is above `PAYMENT_EUR_EPS`.
 */

import { isReleasedForBilling as releasedFields } from "@/lib/billing-release";
import { PAYMENT_EUR_EPS } from "@/lib/payment-booking";

/** FA-LEIST-06/07 — same rule for Treatment and Examination. */
export function treatmentHasBillableServiceItem(
    service_name: string | null | undefined,
    total_cost: number | null | undefined,
): boolean {
    if ((service_name ?? "").trim().length > 0) return true;
    const g = total_cost;
    return g != null && Number.isFinite(g) && g > PAYMENT_EUR_EPS;
}

export const examinationHasBillableServiceItem = treatmentHasBillableServiceItem;

/** FA-LEIST-05 — physician billing release recorded on Treatment / Examination rows. */
export function isReleasedForBilling(entry: {
    released_by_physician_id?: string | null;
    released_at?: string | null;
}): boolean {
    return releasedFields(entry.released_by_physician_id, entry.released_at);
}
