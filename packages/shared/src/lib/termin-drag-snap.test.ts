import { describe, expect, it } from "vitest";
import type { Abwesenheit } from "../models/types";
import { readPraxisArbeitszeitenConfig, type PraxisArbeitszeitenConfig } from "./praxis-planning";
import { deriveDayPackingBounds, snapTerminDragPosition } from "./termin-drag-snap";

const TIMELINE = { startMin: 8 * 60, endMin: 19 * 60 };

function cfgSaturdayPractice(): PraxisArbeitszeitenConfig {
    const base = readPraxisArbeitszeitenConfig();
    return {
        ...base,
        slotMin: "30",
        pauseVon: "12:00",
        pauseBis: "13:00",
        plan: {
            ...base.plan,
            sa: { aktiv: true, segments: [{ from: "09:00", to: "13:00" }] },
        },
        arztSchedules: {
            doc1: {
                plan: { ...base.plan, sa: { aktiv: false, segments: [] } },
                pauseVon: base.pauseVon,
                pauseBis: base.pauseBis,
                slotMin: "30",
            },
        },
    };
}

describe("termin-drag-snap", () => {
    it("snaps Saturday drag to practice hours when doctor profile omits Saturday", () => {
        const cfg = cfgSaturdayPractice();
        const snap = snapTerminDragPosition({
            praxisCfg: cfg,
            abwesenheiten: [],
            arztId: "doc1",
            isoDate: "2026-07-11",
            rawStartMin: 10 * 60 + 7,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.dayAllowed).toBe(true);
        expect(snap.slotAllowed).toBe(true);
        expect(snap.startMin).toBe(10 * 60);
    });

    it("snaps away from lunch pause on weekdays", () => {
        const base = readPraxisArbeitszeitenConfig();
        const cfg: PraxisArbeitszeitenConfig = {
            ...base,
            pauseVon: "12:00",
            pauseBis: "13:00",
        };
        const snap = snapTerminDragPosition({
            praxisCfg: cfg,
            abwesenheiten: [],
            arztId: "",
            isoDate: "2026-07-13",
            rawStartMin: 12 * 60 + 15,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.slotAllowed).toBe(true);
        expect(snap.startMin).not.toBe(12 * 60 + 15);
        expect(snap.startMin === 11 * 60 + 30 || snap.startMin === 13 * 60).toBe(true);
    });

    it("rejects closed days", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        const snap = snapTerminDragPosition({
            praxisCfg: cfg,
            abwesenheiten: [],
            arztId: "doc1",
            isoDate: "2026-07-12",
            rawStartMin: 10 * 60,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.dayAllowed).toBe(false);
        expect(snap.slotAllowed).toBe(false);
    });

    it("deriveDayPackingBounds uses booking merge for doctor", () => {
        const cfg = cfgSaturdayPractice();
        const bounds = deriveDayPackingBounds(cfg, "doc1", "2026-07-11");
        expect(bounds).toEqual({ startMin: 9 * 60, endMin: 13 * 60 });
    });

    it("blocks drag during full-day absence", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        const abw: Abwesenheit[] = [
            {
                id: "a1",
                typ: "URLAUB",
                kommentar: null,
                von_tag: "2026-07-13",
                bis_tag: "2026-07-13",
                von_uhrzeit: null,
                bis_uhrzeit: null,
                created_at: "",
                updated_at: "",
            },
        ];
        const snap = snapTerminDragPosition({
            praxisCfg: cfg,
            abwesenheiten: abw,
            arztId: "",
            isoDate: "2026-07-13",
            rawStartMin: 10 * 60,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.slotAllowed).toBe(false);
    });
});
