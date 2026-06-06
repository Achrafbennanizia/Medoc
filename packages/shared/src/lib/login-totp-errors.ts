export function isTotpVerifyError(err: unknown): boolean {
    const raw = typeof err === "string" ? err : err instanceof Error ? err.message : "";
    return raw.toLowerCase().includes("zwei-faktor-code erforderlich");
}

export function isTotpEnrollError(err: unknown): boolean {
    const raw = typeof err === "string" ? err : err instanceof Error ? err.message : "";
    return raw.toLowerCase().includes("zwei-faktor-einrichtung erforderlich");
}
