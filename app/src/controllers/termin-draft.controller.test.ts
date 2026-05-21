import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    loadTerminDraftWithMigration,
    terminDraftKvKey,
    type TerminDraft,
} from "./termin-draft.controller";

vi.mock("@/controllers/app-kv.controller", () => ({
    getAppKvRaw: vi.fn(),
    setAppKvRaw: vi.fn(),
    deleteAppKvRaw: vi.fn(),
}));

import { getAppKvRaw, setAppKvRaw } from "@/controllers/app-kv.controller";

const sample: TerminDraft = {
    datum: "2026-05-20",
    uhrzeit: "10:00",
    patientId: "p1",
    patientQuery: "",
    arztId: "a1",
    art: "KONTROLLE",
    beschwerdenTags: [],
    notizen: "",
    dauerMin: "30",
    statusWunsch: "GEPLANT",
};

describe("terminDraftKvKey", () => {
    it("uses app_kv prefix", () => {
        expect(terminDraftKvKey("550e8400-e29b-41d4-a716-446655440000")).toBe(
            "termin.draft.v1.550e8400-e29b-41d4-a716-446655440000",
        );
    });
});

describe("loadTerminDraftWithMigration", () => {
    const ls = new Map<string, string>();

    beforeEach(() => {
        vi.mocked(getAppKvRaw).mockReset();
        vi.mocked(setAppKvRaw).mockReset();
        ls.clear();
        const storage = {
            getItem: (k: string) => ls.get(k) ?? null,
            setItem: (k: string, v: string) => {
                ls.set(k, v);
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
        const d = await loadTerminDraftWithMigration("draft-1");
        expect(d?.patientId).toBe("p1");
        expect(setAppKvRaw).not.toHaveBeenCalled();
    });

    it("migrates legacy localStorage once", async () => {
        vi.mocked(getAppKvRaw).mockResolvedValue(null);
        ls.set("medoc-termin-draft-draft-2", JSON.stringify(sample));
        const d = await loadTerminDraftWithMigration("draft-2");
        expect(d?.datum).toBe("2026-05-20");
        expect(setAppKvRaw).toHaveBeenCalledWith(
            "termin.draft.v1.draft-2",
            expect.any(String),
        );
        expect(ls.has("medoc-termin-draft-draft-2")).toBe(false);
    });
});
