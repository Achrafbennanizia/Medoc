import { afterEach, describe, expect, it, vi } from "vitest";
import {
    PRACTICE_WORK_HOURS_LS_KEY,
    loadPracticeWorkHoursConfig,
    savePracticeWorkHoursConfig,
} from "./practice-planning";

const getAppKv = vi.fn();
const setAppKv = vi.fn();

vi.mock("@/systems/practice-host/controllers/app-kv.controller", () => ({
    getAppKv: (...args: unknown[]) => getAppKv(...args),
    setAppKv: (...args: unknown[]) => setAppKv(...args),
}));

describe("practice work hours kv", () => {
    afterEach(() => {
        getAppKv.mockReset();
        setAppKv.mockReset();
        localStorage.clear();
    });

    it("localstorage_value_is_migrated_once", async () => {
        getAppKv.mockResolvedValueOnce(null);
        setAppKv.mockResolvedValue(undefined);
        localStorage.setItem(PRACTICE_WORK_HOURS_LS_KEY, JSON.stringify({ plan: { mo: { active: true, segments: [] } } }));
        await loadPracticeWorkHoursConfig();
        expect(setAppKv).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(PRACTICE_WORK_HOURS_LS_KEY)).toBeNull();
    });

    it("work_hours_cache_not_updated_when_save_fails", async () => {
        const cfg = {
            plan: {
                mo: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
                di: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
                mi: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
                do: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
                fr: { active: true, segments: [{ from: "08:00", to: "15:00" }] },
                sa: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
                so: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
            },
            breakFrom: "12:30",
            breakUntil: "13:30",
            slotMin: "30",
            closures: [],
        };
        setAppKv.mockRejectedValueOnce(new Error("kv down"));
        await expect(savePracticeWorkHoursConfig(cfg)).rejects.toThrow("kv down");
        expect(localStorage.getItem(PRACTICE_WORK_HOURS_LS_KEY)).toBeNull();
    });
});
