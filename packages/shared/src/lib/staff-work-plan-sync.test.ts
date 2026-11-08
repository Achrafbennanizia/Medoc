import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = new Map<string, string>();
vi.mock("@/systems/practice-host/controllers/app-kv.controller", () => ({
    getAppKv: vi.fn(async (key: string) => kv.get(key) ?? null),
    setAppKv: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
    }),
}));

import { hydrateWorkPlanStore, persistWorkPlanStore, type WorkPlanStore } from "./staff-work-plan";
import { saveSickLeaveCertificateAtomic } from "./sick-leave-certificate-orchestrator";

const block = (id: string, staffId: string, date: string) => ({
    id,
    staffId,
    date,
    startMin: 480,
    endMin: 720,
    title: "Shift",
});

function emptyStore(): WorkPlanStore {
    return {
        blocks: [],
        settings: { dayStartMin: 420, dayEndMin: 1200, snapMin: 15, pxPerMin: 1 },
        presets: [],
        weeklyRules: [],
        planPreferences: [],
        composeEntries: [],
    };
}

describe("work plan sync (F32, F123)", () => {
    beforeEach(() => {
        kv.clear();
        localStorage.clear();
    });

    it("sick leave rewrites only the affected staff slice from the synced store", async () => {
        await persistWorkPlanStore({
            ...emptyStore(),
            blocks: [block("a1", "staff-a", "2026-11-10"), block("b1", "staff-b", "2026-11-10")],
        });
        const otherBefore = kv.get("staff.work_plan.v1.staff-b");
        localStorage.clear();

        const res = await saveSickLeaveCertificateAtomic(async () => ({ id: "cert-1" }), {
            staffId: "staff-a",
            note: "",
            documentRef: "",
            dateFrom: "2026-11-10",
        });

        expect(res.cancelledBlockCount).toBe(1);
        expect(JSON.parse(kv.get("staff.work_plan.v1.staff-a") ?? "{}").blocks).toEqual([]);
        expect(kv.get("staff.work_plan.v1.staff-b")).toBe(otherBefore);
    });

    it("restores the staff slice when the certificate save fails", async () => {
        await persistWorkPlanStore({ ...emptyStore(), blocks: [block("a1", "staff-a", "2026-11-10")] });
        await expect(
            saveSickLeaveCertificateAtomic(async () => {
                throw new Error("ipc failed");
            }, { staffId: "staff-a", note: "", documentRef: "", dateFrom: "2026-11-10" }),
        ).rejects.toThrow("ipc failed");
        expect(JSON.parse(kv.get("staff.work_plan.v1.staff-a") ?? "{}").blocks).toHaveLength(1);
    });

    it("keeps all-staff preferences and does not duplicate shared ones", async () => {
        const allStaff = { id: "pref-all", name: "All", staffIds: [], kind: "work", layer: 0, parentId: null, scopeType: "general", weekdays: [1], startMin: 480, endMin: 960 };
        const two = { id: "pref-two", name: "Two", staffIds: ["staff-a", "staff-b"], kind: "work", layer: 1, parentId: null, scopeType: "general", weekdays: [2], startMin: 480, endMin: 960 };
        await persistWorkPlanStore({
            ...emptyStore(),
            blocks: [block("a1", "staff-a", "2026-11-10"), block("b1", "staff-b", "2026-11-10")],
            planPreferences: [allStaff, two] as unknown as WorkPlanStore["planPreferences"],
        });
        localStorage.clear();
        const s = await hydrateWorkPlanStore(["staff-a", "staff-b"]);
        const ids = s.planPreferences.map((p) => p.id).sort();
        expect(ids).toEqual(["pref-all", "pref-two"]);
    });
});
