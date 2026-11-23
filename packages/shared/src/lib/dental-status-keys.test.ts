import { describe, expect, it } from "vitest";
import { findingToStatusKey, findingToStatusKeys, statusKeysToFinding } from "./dental";
import { dentalFindingUpsertsFromExamination, EXAMINATION_V1_EMPTY } from "./examination";

describe("combined tooth statuses", () => {
    it("reads every key of a combined finding, first one primary", () => {
        expect(findingToStatusKeys("crown,caries")).toEqual(["crown", "caries"]);
        expect(findingToStatusKey("crown,caries")).toBe("caries");
    });

    it("treats empty, unknown and healthy as one healthy key", () => {
        expect(findingToStatusKeys(null)).toEqual(["healthy"]);
        expect(findingToStatusKeys("healthy,caries")).toEqual(["caries"]);
        expect(statusKeysToFinding([])).toBe("healthy");
        expect(statusKeysToFinding(["healthy", "filling"])).toBe("filling");
    });

    it("writes the combination to the chart when the examination is saved", () => {
        const json = JSON.stringify({ ...EXAMINATION_V1_EMPTY, toothStatuses: { "36": "filling,caries" } });
        const [row] = dentalFindingUpsertsFromExamination("chart-1", json, []);
        expect(row).toMatchObject({ tooth_number: 36, finding: "filling,caries" });
    });
});
