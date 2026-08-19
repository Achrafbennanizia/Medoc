import { describe, expect, it } from "vitest";
import type { Examination } from "@/models/types";
import {
    clinicalSummaryFromExamination,
    hasExamContent,
    examinationToothNotesForTooth,
    EXAMINATION_V1_EMPTY,
} from "./examination";

function row(partial: Partial<Examination>): Examination {
    return {
        id: "u1",
        chart_id: "a1",
        chief_complaint: null,
        results: null,
        diagnosis: null,
        created_at: "2026-01-01T00:00:00Z",
        ...partial,
    };
}

describe("clinicalSummaryFromExamination", () => {
    it("merges V1 JSON with legacy diagnosis column", () => {
        const results = JSON.stringify({
            ...EXAMINATION_V1_EMPTY,
            version: 1,
            diagnosis: "K02.1",
            plan: "Composite 36, recall 6m",
            generalNote: "Routine check",
        });
        const s = clinicalSummaryFromExamination(row({ results, diagnosis: "Legacy" }));
        expect(s.diagnosis).toBe("K02.1");
        expect(s.plan).toBe("Composite 36, recall 6m");
        expect(s.generalNote).toBe("Routine check");
    });

    it("falls back to diagnosis and chief complaint when JSON is missing", () => {
        const s = clinicalSummaryFromExamination(
            row({ diagnosis: "Gingivitis", chief_complaint: "Bleeding on brushing" }),
        );
        expect(s.diagnosis).toBe("Gingivitis");
        expect(s.plan).toBe("");
        expect(s.generalNote).toBe("Bleeding on brushing");
        expect(s.detail).toBeNull();
    });
});

describe("examinationToothNotesForTooth", () => {
    it("returns per-tooth notes newest first", () => {
        const older = row({
            id: "u-old",
            created_at: "2026-01-01T00:00:00Z",
            examination_number: "U-001",
            results: JSON.stringify({
                ...EXAMINATION_V1_EMPTY,
                version: 1,
                toothNotes: { "36": "Old note" },
            }),
        });
        const newer = row({
            id: "u-new",
            created_at: "2026-02-01T00:00:00Z",
            examination_number: "U-002",
            results: JSON.stringify({
                ...EXAMINATION_V1_EMPTY,
                version: 1,
                toothNotes: { "36": "Recent note", "11": "Incisor" },
            }),
        });
        const notes36 = examinationToothNotesForTooth([older, newer], "36");
        expect(notes36).toHaveLength(2);
        expect(notes36[0]?.note).toBe("Recent note");
        expect(notes36[0]?.examinationNumber).toBe("U-002");
        expect(notes36[1]?.note).toBe("Old note");
        expect(examinationToothNotesForTooth([older, newer], "11")).toHaveLength(1);
        expect(examinationToothNotesForTooth([older, newer], "21")).toHaveLength(0);
    });
});

describe("hasExamContent", () => {
    it("returns false for empty V1 payload", () => {
        expect(hasExamContent(EXAMINATION_V1_EMPTY)).toBe(false);
    });

    it("detects tooth notes and diagnosis", () => {
        expect(
            hasExamContent({
                ...EXAMINATION_V1_EMPTY,
                toothNotes: { "36": "Caries distal" },
            }),
        ).toBe(true);
        expect(
            hasExamContent({
                ...EXAMINATION_V1_EMPTY,
                diagnosis: "K02.1",
            }),
        ).toBe(true);
    });
});
