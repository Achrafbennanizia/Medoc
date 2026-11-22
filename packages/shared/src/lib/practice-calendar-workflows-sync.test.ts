import { describe, expect, it } from "vitest";
import { resolveCalendarWorkflowsMerge } from "./practice-calendar-workflows-sync";

describe("calendar workflows three-way merge", () => {
    it("keeps a local selection that has not reached the shared key yet", () => {
        expect(resolveCalendarWorkflowsMerge("week", "day", "day")).toBe("publish-local");
    });
    it("adopts a newer shared value when nothing changed locally", () => {
        expect(resolveCalendarWorkflowsMerge("day", "month", "day")).toBe("adopt-remote");
    });
    it("lets this device's change win when both sides changed", () => {
        expect(resolveCalendarWorkflowsMerge("week", "month", "day")).toBe("publish-local");
    });
    it("adopts the shared value on a device that never synced", () => {
        expect(resolveCalendarWorkflowsMerge("day", "month", "")).toBe("adopt-remote");
    });
    it("does nothing when both agree", () => {
        expect(resolveCalendarWorkflowsMerge("day", "day", "")).toBe("none");
    });
});
