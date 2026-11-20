import { describe, expect, it } from "vitest";
import { patientMatchesQuery } from "./patient-search";

const p = { name: "Jürgen Müller", insurance_number: "A123456789", date_of_birth: "1980-03-07" };

describe("patientMatchesQuery", () => {
    it("matches name accent-insensitively and by every word", () => {
        expect(patientMatchesQuery(p, "jurgen mul", { includeInsuranceNumber: false })).toBe(true);
        expect(patientMatchesQuery(p, "jurgen schmidt", { includeInsuranceNumber: false })).toBe(false);
    });
    it("honours the insurance-number setting", () => {
        expect(patientMatchesQuery(p, "a1234", { includeInsuranceNumber: true })).toBe(true);
        expect(patientMatchesQuery(p, "a1234", { includeInsuranceNumber: false })).toBe(false);
    });
    it("matches date of birth in ISO and German notation", () => {
        expect(patientMatchesQuery(p, "07.03.1980", { includeInsuranceNumber: false })).toBe(true);
        expect(patientMatchesQuery(p, "1980-03-07", { includeInsuranceNumber: false })).toBe(true);
    });
});
