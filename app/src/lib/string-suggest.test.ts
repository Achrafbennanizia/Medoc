import { describe, expect, it } from "vitest";
import { levenshtein, suggestSimilarTitles } from "./string-suggest";

describe("levenshtein", () => {
    it("returns 0 for equal strings", () => {
        expect(levenshtein("a", "a")).toBe(0);
        expect(levenshtein("", "")).toBe(0);
    });
    it("counts single-character edits", () => {
        expect(levenshtein("kitten", "sitting")).toBe(3);
        expect(levenshtein("termine", "termene")).toBe(1);
    });
});

describe("suggestSimilarTitles", () => {
    it("returns close titles within max distance", () => {
        const titles = ["Terminübersicht", "Patientenakten", "Finanzen"];
        expect(suggestSimilarTitles("terminübersict", titles, 2, 5)).toContain("Terminübersicht");
    });
});
