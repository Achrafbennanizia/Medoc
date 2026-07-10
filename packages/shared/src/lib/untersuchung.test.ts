import { describe, expect, it } from "vitest";
import type { Untersuchung } from "@/models/types";
import {
    clinicalSummaryFromUntersuchung,
    hasExamContent,
    untersuchungToothNotesForTooth,
    UNTERSUCHUNG_V1_EMPTY,
} from "./untersuchung";

function row(partial: Partial<Untersuchung>): Untersuchung {
    return {
        id: "u1",
        akte_id: "a1",
        beschwerden: null,
        ergebnisse: null,
        diagnose: null,
        created_at: "2026-01-01T00:00:00Z",
        ...partial,
    };
}

describe("clinicalSummaryFromUntersuchung", () => {
    it("merges V1 JSON with legacy diagnose column", () => {
        const ergebnisse = JSON.stringify({
            ...UNTERSUCHUNG_V1_EMPTY,
            version: 1,
            diagnosis: "K02.1",
            plan: "Composite 36, recall 6m",
            generalNote: "Routine check",
        });
        const s = clinicalSummaryFromUntersuchung(row({ ergebnisse, diagnose: "Legacy" }));
        expect(s.diagnosis).toBe("K02.1");
        expect(s.plan).toBe("Composite 36, recall 6m");
        expect(s.generalNote).toBe("Routine check");
    });

    it("falls back to diagnose and beschwerden when JSON missing", () => {
        const s = clinicalSummaryFromUntersuchung(
            row({ diagnose: "Gingivitis", beschwerden: "Bleeding on brushing" }),
        );
        expect(s.diagnosis).toBe("Gingivitis");
        expect(s.plan).toBe("");
        expect(s.generalNote).toBe("Bleeding on brushing");
        expect(s.detail).toBeNull();
    });
});

describe("untersuchungToothNotesForTooth", () => {
    it("returns per-tooth notes newest first", () => {
        const older = row({
            id: "u-old",
            created_at: "2026-01-01T00:00:00Z",
            untersuchungsnummer: "U-001",
            ergebnisse: JSON.stringify({
                ...UNTERSUCHUNG_V1_EMPTY,
                version: 1,
                toothNotes: { "36": "Old note" },
            }),
        });
        const newer = row({
            id: "u-new",
            created_at: "2026-02-01T00:00:00Z",
            untersuchungsnummer: "U-002",
            ergebnisse: JSON.stringify({
                ...UNTERSUCHUNG_V1_EMPTY,
                version: 1,
                toothNotes: { "36": "Recent note", "11": "Incisor" },
            }),
        });
        const notes36 = untersuchungToothNotesForTooth([older, newer], "36");
        expect(notes36).toHaveLength(2);
        expect(notes36[0]?.note).toBe("Recent note");
        expect(notes36[0]?.untersuchungsnummer).toBe("U-002");
        expect(notes36[1]?.note).toBe("Old note");
        expect(untersuchungToothNotesForTooth([older, newer], "11")).toHaveLength(1);
        expect(untersuchungToothNotesForTooth([older, newer], "21")).toHaveLength(0);
    });
});

describe("hasExamContent", () => {
    it("returns false for empty V1 payload", () => {
        expect(hasExamContent(UNTERSUCHUNG_V1_EMPTY)).toBe(false);
    });

    it("detects tooth notes and diagnosis", () => {
        expect(
            hasExamContent({
                ...UNTERSUCHUNG_V1_EMPTY,
                toothNotes: { "36": "Caries distal" },
            }),
        ).toBe(true);
        expect(
            hasExamContent({
                ...UNTERSUCHUNG_V1_EMPTY,
                diagnosis: "K02.1",
            }),
        ).toBe(true);
    });
});
