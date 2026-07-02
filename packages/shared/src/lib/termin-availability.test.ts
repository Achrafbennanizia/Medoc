import { describe, expect, it } from "vitest";
import {
    formatAlternativeSlots,
    hasArztSlotConflict,
    isTerminConflictErrorMessage,
    suggestAlternativeTerminSlots,
} from "./termin-availability";
import { readPraxisArbeitszeitenConfig } from "./praxis-planning";
import type { Termin } from "@/models/types";

function termin(partial: Partial<Termin>): Termin {
    return {
        id: "t1",
        datum: "2026-05-21",
        uhrzeit: "10:00",
        art: "KONTROLLE",
        status: "GEPLANT",
        notizen: null,
        beschwerden: null,
        patient_id: "p1",
        arzt_id: "a1",
        created_at: "2026-05-21T08:00:00Z",
        updated_at: "2026-05-21T08:00:00Z",
        ...partial,
    };
}

describe("termin-availability (N4)", () => {
    const praxisCfg = readPraxisArbeitszeitenConfig();

    it("detects conflict messages", () => {
        expect(isTerminConflictErrorMessage("Terminkonflikt")).toBe(true);
        expect(isTerminConflictErrorMessage("Arzt hat bereits einen Termin am 2026-05-21 um 10:00")).toBe(true);
        expect(isTerminConflictErrorMessage("Netzwerkfehler")).toBe(false);
    });

    it("hasArztSlotConflict matches same slot", () => {
        const rows = [termin({ uhrzeit: "10:00:00" })];
        expect(hasArztSlotConflict(rows, "2026-05-21", "10:00", "a1")).toBe(true);
        expect(hasArztSlotConflict(rows, "2026-05-21", "11:00", "a1")).toBe(false);
        expect(hasArztSlotConflict(rows, "2026-05-21", "10:00", "a1", "t1")).toBe(false);
    });

    it("suggests free slots around a busy time", () => {
        const busy = termin({ uhrzeit: "10:00:00" });
        const alts = suggestAlternativeTerminSlots({
            datum: "2026-05-21",
            arztId: "a1",
            preferredUhrzeit: "10:00",
            durMin: 30,
            slotStep: 15,
            termine: [busy],
            praxisCfg,
            abwesenheiten: [],
            t: (k) => k,
        });
        expect(alts.length).toBeGreaterThan(0);
        expect(alts).not.toContain("10:00");
        expect(formatAlternativeSlots(alts, (_k, p) => `${p.time} Uhr`)).toMatch(/Uhr/);
    });
});
