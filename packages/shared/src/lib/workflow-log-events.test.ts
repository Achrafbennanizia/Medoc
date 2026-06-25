// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
    publishWorkflowStep,
    subscribeWorkflowSteps,
    type WorkflowStepEvent,
} from "@/lib/workflow-log-events";

describe("workflow-log-events", () => {
    it("publishes and subscribes workflow events with defaults", () => {
        const seen: WorkflowStepEvent[] = [];
        const stop = subscribeWorkflowSteps((event) => {
            seen.push(event);
        });
        publishWorkflowStep({
            workflow: "route",
            step: "/patienten",
            status: "route_enter",
        });
        stop();
        expect(seen).toHaveLength(1);
        expect(seen[0].workflow).toBe("route");
        expect(seen[0].status).toBe("route_enter");
        expect(seen[0].source).toBe("frontend");
        expect(typeof seen[0].timestamp).toBe("string");
    });
});
