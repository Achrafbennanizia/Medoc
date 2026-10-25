import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    classifyWorkflowFailurePhase,
    logWorkflowEvent,
    workflowRouteFromLocation,
} from "./workflow-logger";

describe("workflow-logger", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redacts dynamic route segments and query values", () => {
        const route = workflowRouteFromLocation(
            "/patients/ab12cd34ef56gh78/orders/12345",
            "?patientName=Alice&tab=details",
        );
        expect(route).toBe("/patients/:id/orders/:id?patientName=*&tab=*");
    });

    it("classifies cancel/abort failures as cancel phase", () => {
        expect(classifyWorkflowFailurePhase(new Error("Request canceled by user"))).toBe("cancel");
        expect(classifyWorkflowFailurePhase(new Error("network abort"))).toBe("cancel");
        expect(classifyWorkflowFailurePhase(new Error("permission denied"))).toBe("error");
    });

    it("sends workflow events through tauri invoke bridge", async () => {
        await logWorkflowEvent({
            phase: "route_enter",
            route: "/login",
            action: "route_change",
        });
        expect(invoke).toHaveBeenCalledWith("log_workflow_event", {
            event: {
                phase: "route_enter",
                route: "/login",
                action: "route_change",
            },
        });
    });
});
