import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { tauriInvoke } from "./tauri.service";

describe("tauriInvoke workflow instrumentation", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("logs start/success workflow events for regular commands", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return undefined;
            if (cmd === "list_patients") return [{ id: "p-1" }];
            throw new Error(`unexpected command ${cmd}`);
        });

        const out = await tauriInvoke<Array<{ id: string }>>("list_patients", {
            patient_id: "p-1",
            optional: undefined,
        });
        expect(out).toEqual([{ id: "p-1" }]);

        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock.mock.calls[0]?.[0]).toBe("log_workflow_event");
        expect(invokeMock.mock.calls[1]).toEqual([
            "list_patients",
            { patient_id: "p-1", patientId: "p-1" },
        ]);
        expect(invokeMock.mock.calls[2]?.[0]).toBe("log_workflow_event");
    });

    it("logs error workflow events and rethrows command failures", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return undefined;
            if (cmd === "create_patient") {
                throw new Error("password=hunter2");
            }
            throw new Error(`unexpected command ${cmd}`);
        });

        await expect(
            tauriInvoke("create_patient", { name: "Alice" }),
        ).rejects.toThrow("password=hunter2");

        const phases = invokeMock.mock.calls
            .filter((row) => row[0] === "log_workflow_event")
            .map((row) => row[1]?.event?.phase);
        expect(phases).toEqual(["primary_action", "error"]);
    });

    it("does not recursively instrument the workflow logging command itself", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await tauriInvoke("log_workflow_event", {
            event: {
                workflow: "ui.ipc",
                phase: "success",
                step: "example",
            },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock.mock.calls[0]).toEqual([
            "log_workflow_event",
            {
                event: {
                    workflow: "ui.ipc",
                    phase: "success",
                    step: "example",
                },
            },
        ]);
    });
});
