import { describe, expect, it } from "vitest";
import type { Termin } from "../models/types";
import { readPraxisArbeitszeitenConfig, type PraxisArbeitszeitenConfig } from "./praxis-planning";
import { buildTerminSlotGrid, hasTerminOverlapForArzt } from "./termin-slot-grid";

function cfgWithSaturday(): PraxisArbeitszeitenConfig {
    const base = readPraxisArbeitszeitenConfig();
    return {
        ...base,
        plan: {
            ...base.plan,
            sa: { aktiv: true, segments: [{ from: "09:00", to: "13:00" }] },
        },
    };
}

function termin(partial: Partial<Termin>): Termin {
    return {
        id: "t1",
        datum: "2026-07-10",
        uhrzeit: "09:00",
        art: "KONTROLLE",
        status: "GEPLANT",
        notizen: "Dauer: 30 min",
        beschwerden: null,
        patient_id: "p1",
        arzt_id: "a1",
        created_at: "2026-07-10T08:00:00Z",
        updated_at: "2026-07-10T08:00:00Z",
        ...partial,
    };
}

describe("termin-slot-grid", () => {
    it("blocks lunch pause from practice config", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        const grid = buildTerminSlotGrid({
            praxisCfg: cfg,
            abwesenheiten: [],
            datum: "2026-07-10",
            arztId: "a1",
            termine: [],
            durMin: 30,
            pufferMin: 0,
        });
        expect(grid.slots).toContain("12:00");
        expect(grid.bookableKeys.has("2026-07-10|12:30")).toBe(false);
        expect(grid.bookableKeys.has("2026-07-10|13:30")).toBe(true);
    });

    it("marks occupied slots for the same Arzt", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        const grid = buildTerminSlotGrid({
            praxisCfg: cfg,
            abwesenheiten: [],
            datum: "2026-07-10",
            arztId: "a1",
            termine: [termin({ uhrzeit: "09:00", notizen: "Dauer: 30 min" })],
            durMin: 30,
            pufferMin: 0,
        });
        expect(grid.bookableKeys.has("2026-07-10|09:00")).toBe(false);
        expect(grid.bookableKeys.has("2026-07-10|09:30")).toBe(true);
        expect(grid.bookableKeys.has("2026-07-10|10:00")).toBe(true);
    });

    it("respects buffer minutes between appointments", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        expect(
            hasTerminOverlapForArzt(
                [termin({ uhrzeit: "09:00", notizen: "Dauer: 30 min" })],
                "2026-07-10",
                "a1",
                9 * 60 + 30,
                30,
                15,
            ),
        ).toBe(true);
        expect(
            hasTerminOverlapForArzt(
                [termin({ uhrzeit: "09:00", notizen: "Dauer: 30 min" })],
                "2026-07-10",
                "a1",
                9 * 60 + 45,
                30,
                15,
            ),
        ).toBe(false);
    });

    it("includes Saturday segments when enabled", () => {
        const cfg = cfgWithSaturday();
        const grid = buildTerminSlotGrid({
            praxisCfg: cfg,
            abwesenheiten: [],
            datum: "2026-07-11",
            arztId: "a1",
            termine: [],
            durMin: 30,
            pufferMin: 0,
        });
        expect(grid.slots).toContain("09:00");
        expect(grid.bookableKeys.has("2026-07-11|09:00")).toBe(true);
    });

    it("uses practice Saturday hours when doctor profile omits Saturday", () => {
        const cfg = cfgWithSaturday();
        const withDoctor: PraxisArbeitszeitenConfig = {
            ...cfg,
            arztSchedules: {
                "a1": {
                    plan: {
                        ...cfg.plan,
                        sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
                    },
                    pauseVon: cfg.pauseVon,
                    pauseBis: cfg.pauseBis,
                    slotMin: cfg.slotMin,
                },
            },
        };
        const grid = buildTerminSlotGrid({
            praxisCfg: withDoctor,
            abwesenheiten: [],
            datum: "2026-07-11",
            arztId: "a1",
            termine: [],
            durMin: 30,
            pufferMin: 0,
        });
        expect(grid.slots.length).toBeGreaterThan(0);
        expect(grid.bookableKeys.has("2026-07-11|09:00")).toBe(true);
    });
});
