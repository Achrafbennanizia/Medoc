import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import {
    emitWorkflowEvent,
    normalizeWorkflowRoute,
    WORKFLOW_LOG_COMMAND,
} from "./workflow-log.service";

describe("workflow-log.service", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("normalizes id-like route segments", () => {
        expect(normalizeWorkflowRoute("/patienten/2d76976d-7e44-4db9-bec8-cf2884925fd1")).toBe(
            "/patienten/:id",
        );
        expect(normalizeWorkflowRoute("/tickets/seed-pat-001/bearbeiten")).toBe(
            "/tickets/:id/bearbeiten",
        );
    });

    it("emits bounded workflow payload via dedicated IPC command", async () => {
        invokeMock.mockResolvedValue(undefined);
        await emitWorkflowEvent({
            phase: "command",
            step: "invoke",
            outcome: "start",
            command: "create_patient",
            detail: "x".repeat(800),
            durationMs: 12.2,
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        const [cmd, payload] = invokeMock.mock.calls[0] as [
            string,
            { event: Record<string, unknown> },
        ];
        expect(cmd).toBe(WORKFLOW_LOG_COMMAND);
        expect(payload.event.command).toBe("create_patient");
        expect(typeof payload.event.detail).toBe("string");
        expect((payload.event.detail as string).length).toBeLessThanOrEqual(512);
        expect(payload.event.durationMs).toBe(12);
    });

    it("never throws when IPC channel is unavailable", async () => {
        invokeMock.mockRejectedValue(new Error("no tauri bridge"));
        await expect(
            emitWorkflowEvent({
                phase: "route",
                step: "enter",
                outcome: "success",
                route: "/login",
            }),
        ).resolves.toBeUndefined();
    });
});
