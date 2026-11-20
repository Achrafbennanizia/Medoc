import { describe, expect, it } from "vitest";
import {
    buildPlanNextPracticeTask,
    emptyPlanNextAppointment,
    type PlanNextAppointmentV2,
} from "./plan-next-appointment";

const labels = {
    titleFallback: "Plan next appointment",
    urgencyLabel: (u: string) => (u === "dringend" ? "Urgent" : u === "bald" ? "Soon" : "Routine"),
    kindLabel: (kind: string) => kind,
    durationLabel: (min: string) => `Duration: ${min} min`,
    intervalLabel: (weeks: string) => `Interval: about ${weeks} weeks`,
    weekdaysLabel: (days: string) => `Preferred weekdays: ${days}`,
    internalLabel: (note: string) => `Internal: ${note}`,
};

describe("buildPlanNextPracticeTask", () => {
    it("returns null for an empty note", () => {
        expect(buildPlanNextPracticeTask(emptyPlanNextAppointment(), labels)).toBeNull();
    });

    it("builds a reception-pool task draft from structured fields", () => {
        const plan: PlanNextAppointmentV2 = {
            ...emptyPlanNextAppointment(),
            freeText: "Check crown 26",
            urgency: "bald",
            appointmentKindHint: "CHECKUP",
            durationMin: "30",
            intervalWeeks: "4",
            preferredWeekdays: "Mon, Thu",
            internalNote: "Prefer morning",
        };
        const draft = buildPlanNextPracticeTask(plan, labels);
        expect(draft).not.toBeNull();
        expect(draft!.title).toBe("Check crown 26");
        expect(draft!.body).toContain("Soon");
        expect(draft!.body).toContain("CHECKUP");
        expect(draft!.body).toContain("Duration: 30 min");
        expect(draft!.body).toContain("Interval: about 4 weeks");
        expect(draft!.body).toContain("Preferred weekdays: Mon, Thu");
        expect(draft!.body).toContain("Internal: Prefer morning");
    });

    it("uses the fallback title when free text is empty", () => {
        const plan: PlanNextAppointmentV2 = {
            ...emptyPlanNextAppointment(),
            urgency: "dringend",
            durationMin: "45",
        };
        const draft = buildPlanNextPracticeTask(plan, labels);
        expect(draft!.title).toBe("Plan next appointment");
        expect(draft!.body).toContain("Urgent");
        expect(draft!.body).toContain("Duration: 45 min");
    });
});
