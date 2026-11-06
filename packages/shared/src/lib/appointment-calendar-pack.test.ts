import { describe, expect, it } from "vitest";
import { computePackedUpdatesAfterMove } from "./appointment-calendar-ui";
import { readPracticeWorkHoursConfig, type PracticeWorkHoursConfig } from "./practice-planning";
import type { Appointment } from "@/models/types";

function appointment(partial: Partial<Appointment>): Appointment {
    return {
        id: "t1",
        date: "2026-11-10",
        time: "08:00",
        kind: "CHECKUP",
        status: "PLANNED",
        notes: "Duration: 45 min",
        chief_complaint: null,
        patient_id: "p1",
        physician_id: "doc1",
        created_at: "2026-11-10T08:00:00Z",
        updated_at: "2026-11-10T08:00:00Z",
        ...partial,
    };
}

function hours(): PracticeWorkHoursConfig {
    const base = readPracticeWorkHoursConfig();
    return {
        ...base,
        breakFrom: "12:30",
        breakUntil: "13:30",
        plan: {
            ...base.plan,
            di: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
        },
    };
}

describe("computePackedUpdatesAfterMove", () => {
    it("moves a break-time appointment to the next open hour without shifting the morning", () => {
        const morning = appointment({ id: "morning", time: "08:00", notes: "Duration: 45 min" });
        const treatment = appointment({ id: "treat", time: "13:00", notes: "Duration: 60 min" });
        const result = computePackedUpdatesAfterMove(
            [morning, treatment],
            "treat",
            "2026-11-10",
            13 * 60,
            60,
            5,
            { startMin: 8 * 60, endMin: 17 * 60 },
            { practiceCfg: hours(), absences: [] },
        );
        expect(result.error).toBeUndefined();
        expect(result.updates).toEqual([{ id: "treat", data: { date: "2026-11-10", time: "13:30" } }]);
    });
});
