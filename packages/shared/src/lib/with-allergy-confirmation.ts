/**
 * Saving a prescription whose active substance matches a recorded allergy: the server refuses it
 * with `error.prescription.allergy_conflict` (MD-RXP-001). The doctor is asked, and the save is
 * repeated with `allergy_override` only after they confirm. The server records the override.
 */
import { errorRawText, extractErrorToken } from "./errors/error-resolver";

export const ALLERGY_CONFLICT_KEY = "error.prescription.allergy_conflict";

export type AllergyConflictInfo = { substance: string; allergen: string };

/** Asks the doctor; resolves `true` to issue anyway. */
export type ConfirmAllergy = (conflict: AllergyConflictInfo) => Promise<boolean>;

export function allergyConflictOf(err: unknown): AllergyConflictInfo | null {
    const token = extractErrorToken(errorRawText(err));
    if (token?.key !== ALLERGY_CONFLICT_KEY) return null;
    return { substance: token.params.substance ?? "", allergen: token.params.allergen ?? "" };
}

/** `save(false)`; on an allergy conflict ask, then `save(true)`. `null` when the doctor declined. */
export async function withAllergyConfirmation<T>(
    save: (allergyOverride: boolean) => Promise<T>,
    confirm: ConfirmAllergy,
): Promise<T | null> {
    try {
        return await save(false);
    } catch (e) {
        const conflict = allergyConflictOf(e);
        if (!conflict) throw e;
        if (!(await confirm(conflict))) return null;
        return save(true);
    }
}
