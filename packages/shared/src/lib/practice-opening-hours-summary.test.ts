import { describe, expect, it } from "vitest";
import {
    formatPracticeOpeningHours,
    practiceClosingTimeHm,
    practiceSlotMinutes,
    readPracticeWorkHoursConfig,
    type PracticeDayKey,
} from "./practice-planning";

const EN: Record<PracticeDayKey, string> = {
    mo: "Mon",
    di: "Tue",
    mi: "Wed",
    do: "Thu",
    fr: "Fri",
    sa: "Sat",
    so: "Sun",
};

const DE: Record<PracticeDayKey, string> = {
    mo: "Mo",
    di: "Di",
    mi: "Mi",
    do: "Do",
    fr: "Fr",
    sa: "Sa",
    so: "So",
};

const FR: Record<PracticeDayKey, string> = {
    mo: "Lun",
    di: "Mar",
    mi: "Mer.",
    do: "Jeu",
    fr: "Ven",
    sa: "Sam",
    so: "Dim",
};

const AR: Record<PracticeDayKey, string> = {
    mo: "إث",
    di: "ثل",
    mi: "أر",
    do: "خم",
    fr: "جم",
    sa: "سب",
    so: "أحد",
};

function visible(summary: string): string {
    return summary.replace(/[\u2066\u2069]/g, "");
}

describe("formatPracticeOpeningHours", () => {
    const cfg = readPracticeWorkHoursConfig();

    it("uses Mon–Thu 08:00–17:00, Fri 08:00–15:00 in English", () => {
        expect(visible(formatPracticeOpeningHours(cfg, (key) => EN[key]))).toBe(
            "Mon–Thu 08:00–17:00, Fri 08:00–15:00",
        );
    });

    it("keeps the same from–to form in German, French, and Arabic", () => {
        expect(visible(formatPracticeOpeningHours(cfg, (key) => DE[key]))).toBe(
            "Mo–Do 08:00–17:00, Fr 08:00–15:00",
        );
        expect(visible(formatPracticeOpeningHours(cfg, (key) => FR[key]))).toBe(
            "Lun–Jeu 08:00–17:00, Ven 08:00–15:00",
        );
        expect(visible(formatPracticeOpeningHours(cfg, (key) => AR[key]))).toBe(
            "إث–خم 08:00–17:00, جم 08:00–15:00",
        );
    });

    it("closes the day-end reminder at that day's opening-hours end", () => {
        const monday = new Date(2026, 10, 2); // Monday
        const friday = new Date(2026, 10, 6);
        const saturday = new Date(2026, 10, 7);
        expect(practiceClosingTimeHm(cfg, monday)).toBe("17:00");
        expect(practiceClosingTimeHm(cfg, friday)).toBe("15:00");
        expect(practiceClosingTimeHm(cfg, saturday)).toBeNull();
        expect(practiceSlotMinutes(cfg)).toBe(30);
    });
});
