import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { tauriInvoke } from "./tauri.service";

describe("tauriInvoke", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("expands invoke args and emits workflow start/success events", async () => {
        invokeMock.mockImplementation(async (cmd: string, args: unknown) => {
            if (cmd === "log_workflow_event") return null;
            return { cmd, args };
        });

        const result = await tauriInvoke<{ cmd: string; args: Record<string, unknown> }>(
            "list_patients",
            { patient_id: "p-1" },
        );
        await Promise.resolve();

        expect(result.cmd).toBe("list_patients");
        expect(result.args.patient_id).toBe("p-1");
        expect(result.args.patientId).toBe("p-1");

        const workflowCalls = invokeMock.mock.calls.filter(
            ([cmd]) => cmd === "log_workflow_event",
        );
        expect(workflowCalls).toHaveLength(2);
        expect(workflowCalls[0]?.[1]).toEqual(
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "primary_action",
                    command: "list_patients",
                    outcome: "started",
                }),
            }),
        );
        expect(workflowCalls[1]?.[1]).toEqual(
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "success",
                    command: "list_patients",
                    outcome: "success",
                }),
            }),
        );
    });

    it("does not recursively log the workflow bridge command", async () => {
        invokeMock.mockResolvedValue("ok");
        await tauriInvoke("log_workflow_event", { event: { workflow: "w", step: "s" } });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            event: { workflow: "w", step: "s" },
        });
    });

    it("emits error telemetry when command invoke fails", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return null;
            throw new Error("backend exploded");
        });

        await expect(tauriInvoke("create_patient", { name: "Alice" })).rejects.toThrow(
            "backend exploded",
        );
        await Promise.resolve();

        const workflowCalls = invokeMock.mock.calls.filter(
            ([cmd]) => cmd === "log_workflow_event",
        );
        expect(workflowCalls).toHaveLength(2);
        expect(workflowCalls[1]?.[1]).toEqual(
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "error",
                    outcome: "error",
                    command: "create_patient",
                    error: "backend exploded",
                }),
            }),
        );
    });
});
