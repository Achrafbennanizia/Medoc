import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import {
    logWorkflowEvent,
    normalizeWorkflowRoute,
    resetWorkflowBridgeForTests,
} from "./workflow-logger";

describe("workflow-logger", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        resetWorkflowBridgeForTests();
        const g = globalThis as { __TAURI_INTERNALS__?: unknown; __TAURI_IPC__?: unknown };
        delete g.__TAURI_INTERNALS__;
        delete g.__TAURI_IPC__;
    });

    it("masks id-like segments in route paths", () => {
        expect(
            normalizeWorkflowRoute(
                "/patienten/550e8400-e29b-41d4-a716-446655440000/rezept/12345?tab=akte#foo",
            ),
        ).toBe("/patienten/:id/rezept/:id");
    });

    it("does not invoke backend bridge outside tauri runtime", async () => {
        await logWorkflowEvent({
            eventType: "route_enter",
            route: "/patienten/12345",
        });
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("sends normalized payload when tauri bridge is available", async () => {
        const g = globalThis as { __TAURI_INTERNALS__?: unknown };
        g.__TAURI_INTERNALS__ = {};
        invokeMock.mockResolvedValue(undefined);

        await logWorkflowEvent({
            eventType: "route_enter",
            route: "/patienten/550e8400-e29b-41d4-a716-446655440000",
            action: " enter ",
            detail: "ok",
            correlationId: "abc-123",
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            eventType: "route_enter",
            route: "/patienten/:id",
            action: "enter",
            command: undefined,
            detail: "ok",
            correlationId: "abc-123",
        });
    });

    it("disables repeated attempts after first bridge failure", async () => {
        const g = globalThis as { __TAURI_INTERNALS__?: unknown };
        g.__TAURI_INTERNALS__ = {};
        invokeMock.mockRejectedValueOnce(new Error("bridge unavailable"));

        await logWorkflowEvent({ eventType: "primary_action", command: "list_patienten" });
        await logWorkflowEvent({ eventType: "success", command: "list_patienten" });

        expect(invokeMock).toHaveBeenCalledTimes(1);
    });
});
