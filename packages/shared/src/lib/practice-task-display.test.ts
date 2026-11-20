import { describe, expect, it } from "vitest";
import {
    CANONICAL_TICKET_TITLE_EN,
    canonicalizePracticeTaskLineToEn,
    displayPracticeTaskBody,
    practiceTaskHeadline,
    practiceTaskMatchesInboxKind,
    practiceTaskMatchesInboxView,
    practiceTaskPreview,
    ticketTitleIsMessage,
} from "./practice-task-display";

const catalog: Record<string, string> = {
    "practice.tasks.kind.ticket": "Ticket",
    "patient.detail.plan_next.task_title_fallback": "Plan next appointment",
    "patient.detail.plan_next.urgency.urgent": "Urgent",
    "patient.detail.plan_next.urgency.soon": "Soon",
    "patient.detail.plan_next.urgency.routine": "Routine",
    "patient.detail.plan_next.task_duration": "Duration: {min} min",
    "patient.detail.plan_next.task_interval": "Interval: about {weeks} weeks",
    "patient.detail.plan_next.task_weekdays": "Preferred weekdays: {days}",
    "patient.detail.plan_next.task_internal": "Internal: {note}",
    "appointment.kind.CHECKUP": "Check-up",
    "appointment.kind.TREATMENT": "Treatment",
    "appointment.kind.EXAMINATION": "Examination",
};

const t = (key: string) => catalog[key] ?? key;
const tp = (key: string, params: Record<string, string | number>) => {
    let out = catalog[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
        out = out.replace(`{${k}}`, String(v));
    }
    return out;
};

describe("practiceTaskHeadline", () => {
    it("never uses the ticket message as the list title", () => {
        expect(
            practiceTaskHeadline(
                { kind: "TICKET", title: "22222", body: "22222" },
                t,
            ),
        ).toBe("Ticket");
        expect(
            practiceTaskHeadline(
                { kind: "TICKET", title: CANONICAL_TICKET_TITLE_EN, body: "Please call patient" },
                t,
            ),
        ).toBe("Ticket");
    });

    it("normalizes legacy Arabic plan-next title then shows locale fallback", () => {
        expect(
            practiceTaskHeadline(
                { kind: "APPOINTMENT", title: "تخطيط الموعد التالي", body: "قريبًا" },
                t,
            ),
        ).toBe("Plan next appointment");
    });
});

describe("practiceTaskPreview", () => {
    it("shows ticket message once under the kind title", () => {
        expect(
            practiceTaskPreview(
                { kind: "TICKET", title: "Ticket", body: "Please review X-ray" },
                t,
                tp,
            ),
        ).toBe("Please review X-ray");
        expect(
            practiceTaskPreview({ kind: "TICKET", title: "hi", body: "hi" }, t, tp),
        ).toBe("hi");
    });

    it("joins structured body lines for the list preview", () => {
        const body = ["Soon", "TREATMENT", "Duration: 22 min"].join("\n");
        expect(
            practiceTaskPreview({ kind: "APPOINTMENT", title: "Plan next appointment", body }, t, tp),
        ).toBe("Soon · Treatment · Duration: 22 min");
    });
});

describe("canonicalizePracticeTaskLineToEn", () => {
    it("maps legacy AR/DE markers to English", () => {
        expect(canonicalizePracticeTaskLineToEn("قريبًا")).toBe("Soon");
        expect(canonicalizePracticeTaskLineToEn("علاج")).toBe("TREATMENT");
        expect(canonicalizePracticeTaskLineToEn("المدة: 22 دقيقة")).toBe("Duration: 22 min");
        expect(canonicalizePracticeTaskLineToEn("Dauer: 30 Min.")).toBe("Duration: 30 min");
        expect(canonicalizePracticeTaskLineToEn("تخطيط الموعد التالي")).toBe("Plan next appointment");
    });
});

describe("displayPracticeTaskBody", () => {
    it("maps English plan-next lines into locale templates", () => {
        const body = ["Soon", "CHECKUP", "Duration: 22 min", "Internal: note"].join("\n");
        const shown = displayPracticeTaskBody(body, t, tp);
        expect(shown).toContain("Soon");
        expect(shown).toContain("Check-up");
        expect(shown).toContain("Duration: 22 min");
        expect(shown).toContain("Internal: note");
    });

    it("re-translates legacy Arabic lines via English first", () => {
        const body = ["قريبًا", "علاج", "المدة: 22 دقيقة"].join("\n");
        const shown = displayPracticeTaskBody(body, t, tp);
        expect(shown).toBe("Soon\nTreatment\nDuration: 22 min");
    });
});

describe("ticketTitleIsMessage", () => {
    it("detects legacy message-as-title tickets", () => {
        expect(ticketTitleIsMessage({ kind: "TICKET", title: "abc", body: "abc" })).toBe(true);
        expect(ticketTitleIsMessage({ kind: "TICKET", title: "Ticket", body: "abc" })).toBe(false);
        expect(ticketTitleIsMessage({ kind: "OTHER", title: "abc", body: "abc" })).toBe(false);
    });
});

describe("practiceTaskMatchesInboxView", () => {
    it("buckets status for inbox filters", () => {
        expect(practiceTaskMatchesInboxView("OPEN", "open")).toBe(true);
        expect(practiceTaskMatchesInboxView("DONE", "open")).toBe(false);
        expect(practiceTaskMatchesInboxView("DONE_RECEPTION", "verify")).toBe(true);
        expect(practiceTaskMatchesInboxView("VALIDATED", "done")).toBe(true);
        expect(practiceTaskMatchesInboxView("VIEWED", "all")).toBe(true);
    });
});

describe("practiceTaskMatchesInboxKind", () => {
    it("filters by kind when set", () => {
        expect(practiceTaskMatchesInboxKind("TICKET", "")).toBe(true);
        expect(practiceTaskMatchesInboxKind("TICKET", "TICKET")).toBe(true);
        expect(practiceTaskMatchesInboxKind("BILLING", "TICKET")).toBe(false);
    });
});
