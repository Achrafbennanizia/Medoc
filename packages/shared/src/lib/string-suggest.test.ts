import { describe, expect, it } from "vitest";
import { levenshtein, suggestSimilarTitles } from "./string-suggest";

describe("levenshtein", () => {
    it("returns 0 for equal strings", () => {
        expect(levenshtein("a", "a")).toBe(0);
        expect(levenshtein("", "")).toBe(0);
    });
    it("counts single-character edits", () => {
        expect(levenshtein("kitten", "sitting")).toBe(3);
        expect(levenshtein("appointment", "appointments")).toBe(1);
    });
});

describe("suggestSimilarTitles", () => {
    it("returns close titles within max distance", () => {
        const titles = ["Appointment overview", "Patient records", "Finance"];
        expect(suggestSimilarTitles("appointment overvew", titles, 2, 5)).toContain("Appointment overview");
    });
    it("returns empty when disabled (NFA-USE-10)", () => {
        const titles = ["Appointment overview", "Patient records"];
        expect(suggestSimilarTitles("appointment", titles, 2, 5, { disabled: true })).toEqual([]);
    });
});
