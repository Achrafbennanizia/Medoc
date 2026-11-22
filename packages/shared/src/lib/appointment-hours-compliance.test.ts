import { afterEach, describe, expect, it } from "vitest";
import type { Appointment } from "../models/types";
import { readPracticeWorkHoursConfig, type PracticeWorkHoursConfig } from "./practice-planning";
import { localIsoDate } from "./utils";
import {
    APPOINTMENT_HOURS_COMPLIANCE_DAY_LS_KEY,
    classifyAppointmentHoursBlock,
    findAppointmentsOutsideWorkHours,
    shouldRunDailyComplianceScan,
} from "./appointment-hours-compliance";

function appointment(partial: Partial<Appointment>): Appointment {
    return {
        id: "t1",
        date: "2026-07-13",
        time: "10:00",
        kind: "CHECKUP",
        status: "PLANNED",
        notes: "Duration: 30 min",
        chief_complaint: null,
        patient_id: "p1",
        physician_id: "a1",
        created_at: "2026-07-13T08:00:00Z",
        updated_at: "2026-07-13T08:00:00Z",
        ...partial,
    };
}

describe("findAppointmentsOutsideWorkHours", () => {
    it("flags appointments that land in the lunch break after hours change", () => {
        const base = readPracticeWorkHoursConfig();
        const cfg: PracticeWorkHoursConfig = {
            ...base,
            breakFrom: "12:00",
            breakUntil: "13:00",
        };
        const rows = [
            appointment({ id: "ok", time: "10:00" }),
            appointment({ id: "bad", time: "12:15" }),
        ];
        const violations = findAppointmentsOutsideWorkHours({
            appointments: rows,
            practiceCfg: cfg,
            absences: [],
        });
        expect(violations.map((v) => v.appointmentId)).toEqual(["bad"]);
        expect(violations[0]?.reason).toBe("break");
    });

    it("flags appointments on a full-day special closure", () => {
        const base = readPracticeWorkHoursConfig();
        const cfg: PracticeWorkHoursConfig = {
            ...base,
            closures: [
                {
                    id: "c1",
                    date: "2026-07-13",
                    mode: "FULL_DAY",
                    periods: [],
                    reason: "Holiday",
                },
            ],
        };
        const violations = findAppointmentsOutsideWorkHours({
            appointments: [appointment({ time: "09:00" })],
            practiceCfg: cfg,
            absences: [],
        });
        expect(violations).toHaveLength(1);
        expect(violations[0]?.reason).toBe("closure");
    });

    it("flags appointments during a holiday/absence span", () => {
        const cfg = readPracticeWorkHoursConfig();
        const violations = findAppointmentsOutsideWorkHours({
            appointments: [appointment({ time: "10:00" })],
            practiceCfg: cfg,
            absences: [
                {
                    id: "abs1",
                    kind: "HOLIDAY",
                    comment: "Holiday",
                    from_day: "2026-07-13",
                    to_day: "2026-07-13",
                    from_time: null,
                    to_time: null,
                    created_at: "2026-07-01T00:00:00Z",
                    updated_at: "2026-07-01T00:00:00Z",
                },
            ],
        });
        expect(violations).toHaveLength(1);
        expect(violations[0]?.reason).toBe("absence");
    });

    it("flags appointments outside opening segments", () => {
        const cfg = readPracticeWorkHoursConfig();
        const violations = findAppointmentsOutsideWorkHours({
            appointments: [appointment({ time: "22:00" })],
            practiceCfg: cfg,
            absences: [],
        });
        expect(violations).toHaveLength(1);
        expect(violations[0]?.reason).toBe("outside_hours");
    });

    it("ignores cancelled appointments", () => {
        const cfg = readPracticeWorkHoursConfig();
        const violations = findAppointmentsOutsideWorkHours({
            appointments: [appointment({ status: "CANCELLED", time: "12:30" })],
            practiceCfg: cfg,
            absences: [],
        });
        expect(violations).toHaveLength(0);
    });
});

describe("classifyAppointmentHoursBlock", () => {
    it("returns null when the span is fully within opening hours", () => {
        const cfg = readPracticeWorkHoursConfig();
        expect(classifyAppointmentHoursBlock(cfg, [], "2026-07-13", 10 * 60, 10 * 60 + 30)).toBeNull();
    });
});

describe("shouldRunDailyComplianceScan", () => {
    afterEach(() => {
        try {
            localStorage.removeItem(APPOINTMENT_HOURS_COMPLIANCE_DAY_LS_KEY);
        } catch {
            /* ignore */
        }
    });

    it("runs when no stamp exists", () => {
        expect(shouldRunDailyComplianceScan(null)).toBe(true);
    });

    it("skips when stamp matches today's local date", () => {
        const today = localIsoDate(new Date());
        expect(shouldRunDailyComplianceScan(today)).toBe(false);
    });

    it("runs again on a different local day", () => {
        expect(shouldRunDailyComplianceScan("2020-01-01")).toBe(true);
    });
});
