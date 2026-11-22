/**
 * Pairing confirmation code: 6 digits, shown on the main device and typed on the joining device.
 * Must match `SAS_LEN` in crates/shared/medoc-sync/src/cluster/crypto/sas.rs.
 */
export const PAIRING_CODE_LENGTH = 6;

/** Digits only (Latin, Arabic-Indic and Persian digits accepted), cut to the code length. */
export function normalizePairingCodeInput(raw: string): string {
    const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    return latin.replace(/\D/g, "").slice(0, PAIRING_CODE_LENGTH);
}

export function isCompletePairingCode(code: string): boolean {
    return code.length === PAIRING_CODE_LENGTH && /^\d+$/.test(code);
}
