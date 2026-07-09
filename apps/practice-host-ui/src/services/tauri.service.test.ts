import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logWorkflowEvent, tauriInvoke } from "./tauri.service";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        (globalThis as Record<string, unknown>).__MEDOC_WORKFLOW_LOGGING__ = true;
    });

    afterEach(() => {
        delete (globalThis as Record<string, unknown>).__MEDOC_WORKFLOW_LOGGING__;
    });

    it("emits primary_action and success workflow events around commands", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "workflow_log_event") {
                return;
            }
            if (cmd === "list_patienten") {
                return [{ id: "p1", name: "Alice" }];
            }
            throw new Error(`unexpected command ${cmd}`);
        });

        const rows = await tauriInvoke<Array<{ id: string; name: string }>>("list_patienten");
        expect(rows).toEqual([{ id: "p1", name: "Alice" }]);

        const commands = invokeMock.mock.calls.map((call) => call[0]);
        expect(commands).toEqual([
            "workflow_log_event",
            "list_patienten",
            "workflow_log_event",
        ]);

        const firstWorkflowPayload = invokeMock.mock.calls[0][1] as {
            event: { step: string; action: string; status: string };
        };
        const secondWorkflowPayload = invokeMock.mock.calls[2][1] as {
            event: { step: string; action: string; status: string };
        };
        expect(firstWorkflowPayload.event).toMatchObject({
            step: "primary_action",
            action: "list_patienten",
            status: "started",
        });
        expect(secondWorkflowPayload.event).toMatchObject({
            step: "success",
            action: "list_patienten",
            status: "ok",
        });
    });

    it("emits error workflow events when command invocation fails", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "workflow_log_event") {
                return;
            }
            throw new Error("boom");
        });

        await expect(tauriInvoke("create_patient", { patient_id: "p1" })).rejects.toThrow("boom");

        const commands = invokeMock.mock.calls.map((call) => call[0]);
        expect(commands).toEqual([
            "workflow_log_event",
            "create_patient",
            "workflow_log_event",
        ]);
        const errorPayload = invokeMock.mock.calls[2][1] as {
            event: { step: string; status: string; message?: string };
        };
        expect(errorPayload.event.step).toBe("error");
        expect(errorPayload.event.status).toBe("failed");
        expect(errorPayload.event.message).toContain("boom");
    });

    it("does not recurse for workflow_log_event command", async () => {
        invokeMock.mockResolvedValue(undefined);
        await tauriInvoke("workflow_log_event", {
            event: { workflow: "ui.route", step: "route_enter" },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("workflow_log_event", {
            event: { workflow: "ui.route", step: "route_enter" },
        });
    });

    it("sanitizes outbound workflow event shape", async () => {
        invokeMock.mockResolvedValue(undefined);

        await logWorkflowEvent({
            workflow: "   ui.route   ",
            step: "route_enter",
            route: "   /patienten   ",
            action: "   open   ",
            status: "   entered   ",
            metadata: { keep: true, drop: undefined },
        });

        expect(invokeMock).toHaveBeenCalledWith("workflow_log_event", {
            event: {
                workflow: "ui.route",
                step: "route_enter",
                route: "/patienten",
                action: "open",
                status: "entered",
                metadata: { keep: true },
            },
        });
    });
});
