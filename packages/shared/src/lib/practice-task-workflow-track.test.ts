import { describe, expect, it } from "vitest";
import { taskWorkflowTrack } from "./practice-task-workflow-track";

describe("taskWorkflowTrack", () => {
    it("maps TICKET and APPOINTMENT to simple", () => {
        expect(taskWorkflowTrack("TICKET")).toBe("simple");
        expect(taskWorkflowTrack("APPOINTMENT")).toBe("simple");
        expect(taskWorkflowTrack("ticket")).toBe("simple");
    });

    it("maps verify kinds to verify", () => {
        expect(taskWorkflowTrack("BILLING")).toBe("verify");
        expect(taskWorkflowTrack("PRINT")).toBe("verify");
        expect(taskWorkflowTrack("MASTER_DATA")).toBe("verify");
        expect(taskWorkflowTrack("OTHER")).toBe("verify");
    });
});
