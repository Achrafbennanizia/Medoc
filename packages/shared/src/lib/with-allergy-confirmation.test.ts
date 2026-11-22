import { describe, expect, it, vi } from "vitest";
import { allergyConflictOf, withAllergyConfirmation } from "./with-allergy-confirmation";

const conflict = new Error("error.prescription.allergy_conflict|substance=Amoxicillin|allergen=Penicillin");

describe("withAllergyConfirmation", () => {
    it("reads substance and allergen from the server error", () => {
        expect(allergyConflictOf(conflict)).toEqual({ substance: "Amoxicillin", allergen: "Penicillin" });
        expect(allergyConflictOf(new Error("error.app.forbidden"))).toBeNull();
    });

    it("saves with the override only after the doctor confirms", async () => {
        const save = vi.fn(async (override: boolean) => {
            if (!override) throw conflict;
            return "saved";
        });
        const confirm = vi.fn(async () => true);
        await expect(withAllergyConfirmation(save, confirm)).resolves.toBe("saved");
        expect(confirm).toHaveBeenCalledWith({ substance: "Amoxicillin", allergen: "Penicillin" });
        expect(save.mock.calls).toEqual([[false], [true]]);
    });

    it("returns null when the doctor declines and rethrows other errors", async () => {
        const declined = await withAllergyConfirmation(async () => { throw conflict; }, async () => false);
        expect(declined).toBeNull();
        await expect(withAllergyConfirmation(async () => { throw new Error("boom"); }, async () => true)).rejects.toThrow("boom");
    });
});
