import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn<(cmd: string, args: Record<string, unknown>) => Promise<unknown>>();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (cmd: string, args: Record<string, unknown>) => invokeMock(cmd, args),
}));

import { tauriInvoke } from "./tauri.service";

async function flushAsyncWork(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("tauriInvoke workflow telemetry", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits primary_action and success workflow events", async () => {
        invokeMock.mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") return undefined;
            if (cmd === "list_patienten") return [{ id: "p-1" }];
            return undefined;
        });

        const result = await tauriInvoke<Array<{ id: string }>>("list_patienten", {
            patient_id: "p-1",
            optional: undefined,
        });
        await flushAsyncWork();

        expect(result).toEqual([{ id: "p-1" }]);
        expect(invokeMock).toHaveBeenCalledWith(
            "list_patienten",
            expect.objectContaining({
                patient_id: "p-1",
                patientId: "p-1",
            }),
        );

        const workflowCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "log_workflow_event");
        expect(workflowCalls).toHaveLength(2);
        expect(workflowCalls[0]?.[1]).toMatchObject({
            event: expect.objectContaining({
                step: "primary_action",
                action: "list_patienten",
            }),
        });
        expect(workflowCalls[1]?.[1]).toMatchObject({
            event: expect.objectContaining({
                step: "success",
                action: "list_patienten",
            }),
        });
    });

    it("emits error workflow events when IPC fails", async () => {
        invokeMock.mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") return undefined;
            if (cmd === "create_patient") throw new Error("boom");
            return undefined;
        });

        await expect(tauriInvoke("create_patient", { name: "Alice" })).rejects.toThrow("boom");
        await flushAsyncWork();

        const workflowCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "log_workflow_event");
        expect(workflowCalls).toHaveLength(2);
        expect(workflowCalls[1]?.[1]).toMatchObject({
            event: expect.objectContaining({
                step: "error",
                action: "create_patient",
                error: "boom",
            }),
        });
    });

    it("does not recursively emit telemetry for log_workflow_event", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", { event: { step: "success", action: "noop" } });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "success",
                    action: "noop",
                }),
            }),
        );
    });
});
