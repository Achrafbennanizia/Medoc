/**
 * FA-LEIST-05 — mirrors `domain/services/pricing.rs` (`is_released_for_billing`).
 * Authoritative enforcement is on the backend; this module is for UI hints and tests.
 */

export function isReleasedForBilling(
    freigegebenVonArztId: string | null | undefined,
    freigegebenAm: string | null | undefined,
): boolean {
    const vid = (freigegebenVonArztId ?? "").trim();
    const vam = (freigegebenAm ?? "").trim();
    return vid.length > 0 && vam.length > 0;
}

export function billingReleaseErrorDe(entityLabel: string): string {
    return `${entityLabel} ist noch nicht zur Abrechnung freigegeben (FA-LEIST-05).`;
}

export function requireReleasedForBilling(
    freigegebenVonArztId: string | null | undefined,
    freigegebenAm: string | null | undefined,
    entityLabel: string,
): void {
    if (!isReleasedForBilling(freigegebenVonArztId, freigegebenAm)) {
        throw new Error(billingReleaseErrorDe(entityLabel));
    }
}
