import { describe, expect, it } from "vitest";
import {
    appointmentOverlapLaneInsets,
    assignAppointmentOverlapLanes,
} from "./appointment-overlap";

describe("assignAppointmentOverlapLanes", () => {
    it("keeps non-overlapping appointments in a single lane", () => {
        const lanes = assignAppointmentOverlapLanes([
            { id: "a", startMin: 8 * 60, endMin: 8 * 60 + 30 },
            { id: "b", startMin: 9 * 60, endMin: 9 * 60 + 45 },
        ]);
        expect(lanes.get("a")).toEqual({ col: 0, colCount: 1 });
        expect(lanes.get("b")).toEqual({ col: 0, colCount: 1 });
    });

    it("places overlapping appointments side by side", () => {
        const lanes = assignAppointmentOverlapLanes([
            { id: "a", startMin: 8 * 60, endMin: 8 * 60 + 45 },
            { id: "b", startMin: 8 * 60 + 15, endMin: 8 * 60 + 45 },
        ]);
        expect(lanes.get("a")?.col).toBe(0);
        expect(lanes.get("b")?.col).toBe(1);
        expect(lanes.get("a")?.colCount).toBe(2);
        expect(lanes.get("b")?.colCount).toBe(2);
    });
});

describe("appointmentOverlapLaneInsets", () => {
    it("uses full width for a single lane", () => {
        expect(appointmentOverlapLaneInsets({ col: 0, colCount: 1 })).toEqual({
            insetInlineStart: "4px",
            width: "calc(100% - 8px)",
        });
    });
});
