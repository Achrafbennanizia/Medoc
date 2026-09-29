import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
    emitWorkflowEvent,
    isWorkflowLoggingCommand,
    normalizeWorkflowRoute,
} from "./workflow-bridge";

describe("workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("normalizes dynamic route segments", () => {
        expect(normalizeWorkflowRoute("/")).toBe("/");
        expect(normalizeWorkflowRoute("/patients/123")).toBe("/patients/:id");
        expect(
            normalizeWorkflowRoute(
                "/patients/123e4567-e89b-12d3-a456-426614174000",
            ),
        ).toBe("/patients/:id");
        expect(
            normalizeWorkflowRoute("/onboarding/token/THIS_IS_A_VERY_LONG_TOKEN_123456"),
        ).toBe("/onboarding/token/:id");
    });

    it("identifies the workflow logging command", () => {
        expect(isWorkflowLoggingCommand("log_workflow_event")).toBe(true);
        expect(isWorkflowLoggingCommand("list_patients")).toBe(false);
    });

    it("sends sanitized event payloads to backend", async () => {
        invokeMock.mockResolvedValueOnce(undefined);

        await emitWorkflowEvent({
            workflow: "ui.ipc",
            phase: "primary_action",
            step: "create_patient",
            route: "/patients/123",
            context: { note: "hello", deep: { ok: true } },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ui.ipc",
                    phase: "primary_action",
                    step: "create_patient",
                    route: "/patients/:id",
                }),
            }),
        );
    });

    it("does not throw when IPC bridge is unavailable", async () => {
        invokeMock.mockRejectedValueOnce(new Error("IPC unavailable"));
        await expect(
            emitWorkflowEvent({
                workflow: "ui.navigation",
                phase: "route_enter",
                step: "route_enter",
                route: "/dashboard",
            }),
        ).resolves.toBeUndefined();
    });
});
