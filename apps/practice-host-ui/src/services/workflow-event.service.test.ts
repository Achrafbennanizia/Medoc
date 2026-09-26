import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEvent,
    emitWorkflowEventBestEffort,
    normalizeWorkflowRoute,
    WORKFLOW_EVENT_COMMAND,
} from "./workflow-event.service";

describe("normalizeWorkflowRoute", () => {
    it("masks numeric and UUID-like route segments", () => {
        expect(normalizeWorkflowRoute("/patients/123/appointments/550e8400-e29b-41d4-a716-446655440000")).toBe(
            "/patients/:id/appointments/:id",
        );
    });

    it("drops query/hash and keeps root fallback", () => {
        expect(normalizeWorkflowRoute("/patients/list?page=2#header")).toBe("/patients/list");
        expect(normalizeWorkflowRoute("")).toBe("/");
    });
});

describe("emitWorkflowEvent", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(invoke).mockResolvedValue(undefined);
    });

    it("emits sanitized workflow payload via dedicated command", async () => {
        await emitWorkflowEvent({
            stage: "route_enter",
            workflow: " route:patients ",
            route: "/patients/123?tab=overview",
            source: " frontend-router ",
            action: " enter ",
        });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith(WORKFLOW_EVENT_COMMAND, {
            event: {
                stage: "route_enter",
                workflow: "route:patients",
                route: "/patients/:id",
                source: "frontend-router",
                action: "enter",
                errorKind: undefined,
                durationMs: undefined,
            },
        });
    });

    it("best-effort emitter swallows invoke errors", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("bridge down"));
        expect(() =>
            emitWorkflowEventBestEffort({
                stage: "cancel",
                workflow: "logout.confirm",
            }),
        ).not.toThrow();
    });
});
