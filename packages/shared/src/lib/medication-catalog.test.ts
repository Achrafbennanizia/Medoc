import { describe, expect, it } from "vitest";
import { defaultMedicationCatalog, medicationSuggestions, parseMedicationCatalog } from "./medication-catalog";

describe("medication catalogue", () => {
    it("starts from the built-in list", () => {
        expect(defaultMedicationCatalog().length).toBeGreaterThan(0);
        expect(parseMedicationCatalog("")).toBeNull();
    });
    it("reads stored entries, dropping ones without a name and filling defaults", () => {
        const list = parseMedicationCatalog(JSON.stringify([{ id: "a", label: "Ibuprofen 400 mg", dosage: "1-0-1" }, { dosage: "x" }]));
        expect(list).toHaveLength(1);
        expect(list?.[0]).toMatchObject({ id: "a", label: "Ibuprofen 400 mg", dosage: "1-0-1", active: true, duration: "" });
    });
    it("suggests only active medications", () => {
        const list = parseMedicationCatalog(JSON.stringify([{ label: "A" }, { label: "B", active: false }]))!;
        expect(medicationSuggestions(list).map((s) => s.label)).toEqual(["A"]);
    });
});
