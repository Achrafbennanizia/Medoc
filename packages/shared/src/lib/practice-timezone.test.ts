import { afterEach, describe, expect, it } from "vitest";
import {
    DEFAULT_PRACTICE_TIMEZONE,
    PRACTICE_TIMEZONE_LS_KEY,
    hydratePracticeTimezoneFromAppKv,
    mirrorPracticeTimezoneLocal,
    practiceTimezone,
    practiceTimezoneWriteEpochNow,
    practiceTodayYmd,
    subscribePracticeTimezone,
    ymdInTimeZone,
} from "./practice-timezone";

describe("practice-timezone", () => {
    afterEach(() => {
        try {
            localStorage.removeItem(PRACTICE_TIMEZONE_LS_KEY);
        } catch {
            /* ignore */
        }
    });

    it("defaults to Europe/Berlin", () => {
        expect(practiceTimezone()).toBe(DEFAULT_PRACTICE_TIMEZONE);
    });

    it("mirrors and notifies subscribers", () => {
        let hits = 0;
        const unsub = subscribePracticeTimezone(() => {
            hits += 1;
        });
        expect(mirrorPracticeTimezoneLocal("America/New_York")).toBe("America/New_York");
        expect(practiceTimezone()).toBe("America/New_York");
        expect(hits).toBe(1);
        unsub();
    });

    it("rejects unknown zones", () => {
        expect(mirrorPracticeTimezoneLocal("Not/AZone")).toBe(DEFAULT_PRACTICE_TIMEZONE);
    });

    it("formats a UTC instant into the practice calendar day", () => {
        // 2026-06-15 22:30 UTC → 2026-06-16 00:30 in Berlin (CEST).
        const utc = new Date("2026-06-15T22:30:00Z");
        expect(ymdInTimeZone(utc, "Europe/Berlin")).toBe("2026-06-16");
        expect(ymdInTimeZone(utc, "UTC")).toBe("2026-06-15");
    });

    it("practiceTodayYmd follows the active zone", () => {
        mirrorPracticeTimezoneLocal("UTC");
        const fixed = new Date("2026-11-20T23:30:00Z");
        expect(practiceTodayYmd(fixed, "UTC")).toBe("2026-11-20");
        expect(practiceTodayYmd(fixed, "Pacific/Kiritimati")).toBe("2026-11-21");
    });

    it("hydrate skips applying KV when a newer local mirror landed during the await", async () => {
        mirrorPracticeTimezoneLocal("UTC");
        const epochBefore = practiceTimezoneWriteEpochNow();
        const zone = await hydratePracticeTimezoneFromAppKv(async () => {
            // Simulate Settings → Practice changing the zone while KV is still loading.
            mirrorPracticeTimezoneLocal("America/New_York");
            expect(practiceTimezoneWriteEpochNow()).toBeGreaterThan(epochBefore);
            return "Europe/Berlin";
        });
        expect(zone).toBe("America/New_York");
        expect(practiceTimezone()).toBe("America/New_York");
    });
});
