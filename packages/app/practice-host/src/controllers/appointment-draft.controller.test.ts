import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    loadAppointmentDraftWithMigration,
    appointmentDraftKvKey,
    type AppointmentDraft,
} from "./appointment-draft.controller";

vi.mock("@/systems/practice-host/controllers/app-kv.controller", () => ({
    getAppKvRaw: vi.fn(),
    setAppKvRaw: vi.fn(),
    deleteAppKvRaw: vi.fn(),
}));

import { getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";

const sample: AppointmentDraft = {
    date: "2026-05-20",
    time: "10:00",
    patientId: "p1",
    patientQuery: "",
    physicianId: "a1",
    kind: "CHECKUP",
    chiefComplaintTags: [],
    notes: "",
    durationMin: "30",
    statusPreference: "PLANNED",
};

describe("appointmentDraftKvKey", () => {
    it("uses app_kv prefix", () => {
        expect(appointmentDraftKvKey("550e8400-e29b-41d4-a716-446655440000")).toBe(
            "appointment.draft.v1.550e8400-e29b-41d4-a716-446655440000",
        );
    });
});

describe("loadAppointmentDraftWithMigration", () => {
    const ls = new Map<string, string>();

    beforeEach(() => {
        vi.mocked(getAppKvRaw).mockReset();
        vi.mocked(setAppKvRaw).mockReset();
        ls.clear();
        const storage = {
            getItem: (k: string) => ls.get(k) ?? null,
            setItem: (k: string, version: string) => {
                ls.set(k, version);
            },
            removeItem: (k: string) => {
                ls.delete(k);
            },
            clear: () => ls.clear(),
        };
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("window", { localStorage: storage });
    });

    it("returns DB row when present", async () => {
        vi.mocked(getAppKvRaw).mockResolvedValue(JSON.stringify(sample));
        const d = await loadAppointmentDraftWithMigration("draft-1");
        expect(d?.patientId).toBe("p1");
        expect(setAppKvRaw).not.toHaveBeenCalled();
    });

    it("migrates legacy localStorage once", async () => {
        vi.mocked(getAppKvRaw).mockResolvedValue(null);
        ls.set("medoc-appointment-draft-draft-2", JSON.stringify(sample));
        const d = await loadAppointmentDraftWithMigration("draft-2");
        expect(d?.date).toBe("2026-05-20");
        expect(setAppKvRaw).toHaveBeenCalledWith(
            "appointment.draft.v1.draft-2",
            expect.any(String),
        );
        expect(ls.has("medoc-appointment-draft-draft-2")).toBe(false);
    });
});
