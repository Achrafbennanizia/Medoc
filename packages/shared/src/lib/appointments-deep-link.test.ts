import { describe, expect, it } from "vitest";
import { resolveAppointmentsDeepLink } from "./appointments-deep-link";

describe("resolveAppointmentsDeepLink", () => {
    const now = new Date("2026-11-20T12:00:00");

    it("honors view=week with date without forcing day", () => {
        const nav = resolveAppointmentsDeepLink({
            viewParam: "week",
            dateParam: "2026-11-18",
            now,
        });
        expect(nav?.view).toBe("week");
        expect(nav?.dayOffset).toBe(0);
        expect(nav?.weekOffset).toBe(0);
    });

    it("defaults to day when only date is present", () => {
        const nav = resolveAppointmentsDeepLink({
            viewParam: null,
            dateParam: "2026-11-21",
            now,
        });
        expect(nav?.view).toBe("day");
        expect(nav?.dayOffset).toBe(1);
        expect(nav?.weekOffset).toBe(0);
    });

    it("applies view alone when date is missing", () => {
        const nav = resolveAppointmentsDeepLink({
            viewParam: "month",
            dateParam: null,
            now,
        });
        expect(nav?.view).toBe("month");
        expect(nav?.applyMonthOffset).toBe(false);
    });
});
