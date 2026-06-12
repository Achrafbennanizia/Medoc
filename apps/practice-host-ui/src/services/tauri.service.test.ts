import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauriInvoke workflow instrumentation", () => {
    const invokeMock = vi.mocked(invoke);

    beforeEach(() => {
        invokeMock.mockReset();
        vi.stubGlobal("window", {
            __TAURI_INTERNALS__: {},
            addEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("logs primary_action and success around regular IPC calls", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ id: "p1" }])
            .mockResolvedValueOnce(undefined);

        const rows = await tauriInvoke<Array<{ id: string }>>("list_patienten", { patient_id: "pat-1" });
        expect(rows).toEqual([{ id: "p1" }]);

        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "primary_action",
                    action: "list_patienten",
                }),
            })
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "list_patienten",
            expect.objectContaining({
                patient_id: "pat-1",
                patientId: "pat-1",
            })
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "success",
                    action: "list_patienten",
                    outcome: "ok",
                }),
            })
        );
    });

    it("logs workflow errors and rethrows the invoke failure", async () => {
        const error = new Error("boom");
        invokeMock
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(undefined);

        await expect(tauriInvoke("create_patient", { name: "Alice" })).rejects.toThrow("boom");
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "error",
                    action: "create_patient",
                    errorKind: "Error",
                }),
            })
        );
    });

    it("does not recursively log workflow bridge calls", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await tauriInvoke("log_workflow_event", {
            event: { workflow: "ipc", step: "success", action: "noop" },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({ action: "noop" }),
            })
        );
    });
});
