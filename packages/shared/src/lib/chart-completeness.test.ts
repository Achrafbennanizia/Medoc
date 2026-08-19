import { describe, expect, it } from "vitest";
import { anamnesisLooksEmpty, computeChartCompleteness } from "./chart-completeness";
import { EMPTY_ANAMNESIS_V1_JSON } from "./anamnesis";

describe("anamnesisLooksEmpty", () => {
    it("treats template JSON as empty", () => {
        expect(anamnesisLooksEmpty(EMPTY_ANAMNESIS_V1_JSON)).toBe(true);
    });
    it("detects filled insuranceStatus", () => {
        const j = JSON.stringify(
            { version: 1, preExisting: {}, medication: {}, allergies: {}, insuranceStatus: "GKV" },
            null,
            2,
        );
        expect(anamnesisLooksEmpty(j)).toBe(false);
    });
});

describe("computeChartCompleteness", () => {
    const base = {
        patientInsuranceNumber: "123456789",
        anamnesisJson: EMPTY_ANAMNESIS_V1_JSON,
        dentalFindingsCount: 1,
        examinationsCount: 1,
        patientStatus: "ACTIVE" as const,
        includeClinicalGaps: true,
    };

    it("flags missing KVNR for all roles", () => {
        const r = computeChartCompleteness({ ...base, patientInsuranceNumber: "  " });
        expect(r.gaps.some((g) => g.id === "kvnr")).toBe(true);
    });

    it("skips clinical gaps when includeClinicalGaps false", () => {
        const r = computeChartCompleteness({
            ...base,
            includeClinicalGaps: false,
            patientInsuranceNumber: "",
        });
        expect(r.gaps.map((g) => g.id)).toEqual(["kvnr"]);
    });

    it("flags empty anamnesis when clinical", () => {
        const r = computeChartCompleteness({
            ...base,
            anamnesisJson: EMPTY_ANAMNESIS_V1_JSON,
        });
        expect(r.gaps.some((g) => g.id === "anamnesis")).toBe(true);
    });

    it("does not require Examination for NEW", () => {
        const r = computeChartCompleteness({
            ...base,
            patientStatus: "NEW",
            examinationsCount: 0,
            dentalFindingsCount: 1,
            anamnesisJson: '{"version":1,"insuranceStatus":"x"}',
        });
        expect(r.gaps.some((g) => g.id === "examination")).toBe(false);
    });

    it("requires Examination when not NEW and none recorded", () => {
        const r = computeChartCompleteness({
            ...base,
            patientStatus: "ACTIVE",
            examinationsCount: 0,
            dentalFindingsCount: 1,
            anamnesisJson: '{"version":1,"insuranceStatus":"x"}',
        });
        expect(r.gaps.some((g) => g.id === "examination")).toBe(true);
    });
});
