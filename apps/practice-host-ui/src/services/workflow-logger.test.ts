import { beforeEach, describe, expect, it, vi } from "vitest";

import { invoke } from "@tauri-apps/api/core";
import { classifyWorkflowError, recordWorkflowEvent, redactRoutePath, workflowErrorDetail } from "./workflow-logger";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("workflow logger helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redacts dynamic route segments", () => {
        expect(redactRoutePath("/patienten/1234567890abcdef1234567890abcdef")).toBe("/patienten/:id");
        expect(redactRoutePath("/termine/42")).toBe("/termine/:id");
        expect(redactRoutePath("/verwaltung/team")).toBe("/verwaltung/team");
    });

    it("classifies abort-like errors as cancel", () => {
        expect(classifyWorkflowError({ name: "AbortError" })).toBe("cancel");
        expect(classifyWorkflowError(new Error("cancelled by user"))).toBe("cancel");
        expect(classifyWorkflowError(new Error("boom"))).toBe("error");
    });

    it("logs workflow events best-effort", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("ipc unavailable"));

        await expect(
            recordWorkflowEvent({
                step: "route_enter",
                route: "/patienten/123",
            }),
        ).resolves.toBeUndefined();

        expect(invoke).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({ event: expect.any(Object) }),
        );
    });

    it("returns stable error detail token", () => {
        expect(workflowErrorDetail(new Error("nope"))).toBe("Error");
    });
});
