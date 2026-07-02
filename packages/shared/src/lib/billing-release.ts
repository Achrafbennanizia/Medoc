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

export type TFn = (key: string) => string;
export type TParamsFn = (key: string, params: Record<string, string | number>) => string;

export function billingReleaseError(t: TParamsFn, entityLabel: string): string {
    return t("error.billing.not_released", { entity: entityLabel });
}

/** @deprecated Use billingReleaseError(t, entityLabel) */
export function billingReleaseErrorDe(entityLabel: string): string {
    return `${entityLabel} is not yet released for billing (FA-LEIST-05).`;
}

export function requireReleasedForBilling(
    freigegebenVonArztId: string | null | undefined,
    freigegebenAm: string | null | undefined,
    entityLabel: string,
    t?: TParamsFn,
): void {
    if (!isReleasedForBilling(freigegebenVonArztId, freigegebenAm)) {
        const msg = t
            ? billingReleaseError(t, entityLabel)
            : billingReleaseErrorDe(entityLabel);
        throw new Error(msg);
    }
}
