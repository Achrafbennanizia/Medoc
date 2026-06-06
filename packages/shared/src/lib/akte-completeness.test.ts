import { describe, expect, it } from "vitest";
import { anamneseLooksEmpty, computeAkteCompleteness } from "./akte-completeness";
import { EMPTY_ANAMNESE_V1_JSON } from "./anamnese";

describe("anamneseLooksEmpty", () => {
    it("treats template JSON as empty", () => {
        expect(anamneseLooksEmpty(EMPTY_ANAMNESE_V1_JSON)).toBe(true);
    });
    it("detects filled versicherungsstatus", () => {
        const j = JSON.stringify(
            { version: 1, vorerkrankungen: {}, medikation: {}, allergien: {}, versicherungsstatus: "GKV" },
            null,
            2,
        );
        expect(anamneseLooksEmpty(j)).toBe(false);
    });
});

describe("computeAkteCompleteness", () => {
    const base = {
        patientVersicherungsnummer: "123456789",
        anamneseJson: EMPTY_ANAMNESE_V1_JSON,
        zahnbefundeCount: 1,
        untersuchungenCount: 1,
        patientStatus: "AKTIV" as const,
        includeClinicalGaps: true,
    };

    it("flags missing KVNR for all roles", () => {
        const r = computeAkteCompleteness({ ...base, patientVersicherungsnummer: "  " });
        expect(r.gaps.some((g) => g.id === "kvnr")).toBe(true);
    });

    it("skips clinical gaps when includeClinicalGaps false", () => {
        const r = computeAkteCompleteness({
            ...base,
            includeClinicalGaps: false,
            patientVersicherungsnummer: "",
        });
        expect(r.gaps.map((g) => g.id)).toEqual(["kvnr"]);
    });

    it("flags empty anamnese when clinical", () => {
        const r = computeAkteCompleteness({
            ...base,
            anamneseJson: EMPTY_ANAMNESE_V1_JSON,
        });
        expect(r.gaps.some((g) => g.id === "anam")).toBe(true);
    });

    it("does not require Untersuchung for NEU", () => {
        const r = computeAkteCompleteness({
            ...base,
            patientStatus: "NEU",
            untersuchungenCount: 0,
            zahnbefundeCount: 1,
            anamneseJson: '{"version":1,"versicherungsstatus":"x"}',
        });
        expect(r.gaps.some((g) => g.id === "unter")).toBe(false);
    });

    it("requires Untersuchung when not NEU and none recorded", () => {
        const r = computeAkteCompleteness({
            ...base,
            patientStatus: "AKTIV",
            untersuchungenCount: 0,
            zahnbefundeCount: 1,
            anamneseJson: '{"version":1,"versicherungsstatus":"x"}',
        });
        expect(r.gaps.some((g) => g.id === "unter")).toBe(true);
    });
});
