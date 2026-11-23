import { describe, expect, it } from "vitest";
import {
    checklistProgress,
    complianceJurisdiction,
    parseComplianceChecklist,
    toggleChecklistItem,
    EMPTY_CHECKLIST,
} from "./compliance-checklist";

describe("compliance checklist", () => {
    it("uses the Moroccan list for practices billing in dirhams", () => {
        expect(complianceJurisdiction("MAD")).toBe("ma");
        expect(complianceJurisdiction(" mad ")).toBe("ma");
        expect(complianceJurisdiction("EUR")).toBe("eu");
        expect(complianceJurisdiction(undefined)).toBe("eu");
    });

    it("records who ticked an item and when, and unticks on a second toggle", () => {
        const now = new Date("2026-11-22T10:00:00Z");
        const once = toggleChecklistItem(EMPTY_CHECKLIST, "consent", "Dr. Rahman", now);
        expect(once.items.consent).toEqual({ done: true, by: "Dr. Rahman", at: "2026-11-22T10:00:00.000Z" });
        expect(checklistProgress(once, "ma")).toEqual({ done: 1, total: 10 });
        expect(toggleChecklistItem(once, "consent", "Dr. Rahman", now).items.consent.done).toBe(false);
    });

    it("reads stored state defensively", () => {
        expect(parseComplianceChecklist("not json")).toEqual(EMPTY_CHECKLIST);
        const s = parseComplianceChecklist(JSON.stringify({ items: { a: { done: true, by: "X", at: "t" }, b: "bad" }, cndpRef: "D-123" }));
        expect(Object.keys(s.items)).toEqual(["a"]);
        expect(s.cndpRef).toBe("D-123");
        expect(s.cndpDate).toBe("");
    });
});
