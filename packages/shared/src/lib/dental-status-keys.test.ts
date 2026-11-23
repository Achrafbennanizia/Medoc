import { describe, expect, it } from "vitest";
import { dentalStatusesCompatible, findingToStatusKey, findingToStatusKeys, statusKeysToFinding, toggleDentalStatus } from "./dental";
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

describe("one click on the chart (toggleDentalStatus)", () => {
    it("stacks compatible statuses and removes one on a second click", () => {
        expect(toggleDentalStatus(["crown"], "caries")).toEqual(["crown", "caries"]);
        expect(toggleDentalStatus(["crown", "caries"], "caries")).toEqual(["crown"]);
        expect(toggleDentalStatus(["crown", "caries"], "healthy")).toEqual([]);
    });

    it("missing removes what needs a tooth, keeps planned and implant", () => {
        expect(toggleDentalStatus(["caries", "filling", "planned"], "missing")).toEqual(["planned", "missing"]);
        expect(toggleDentalStatus(["missing", "planned"], "implant")).toEqual(["missing", "planned", "implant"]);
        // A status that needs the tooth brings it back.
        expect(toggleDentalStatus(["missing", "planned"], "crown")).toEqual(["planned", "crown"]);
    });

    it("an implant and a root fracture replace each other", () => {
        expect(toggleDentalStatus(["root", "crown"], "implant")).toEqual(["crown", "implant"]);
        expect(toggleDentalStatus(["implant"], "root")).toEqual(["root"]);
    });

    it("lists the same combinations Help shows", () => {
        expect(dentalStatusesCompatible(["missing", "planned"])).toBe(true);
        expect(dentalStatusesCompatible(["missing", "caries"])).toBe(false);
        expect(dentalStatusesCompatible(["root", "implant"])).toBe(false);
        expect(dentalStatusesCompatible(["healthy", "caries"])).toBe(false);
    });
});
