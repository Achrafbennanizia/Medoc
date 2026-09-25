import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(globalThis, "window", {
            value: {
                location: { pathname: "/patients/12345" },
            },
            configurable: true,
        });
    });

    it("logs primary action start and success around command invoke", async () => {
        vi.mocked(invoke)
            .mockResolvedValueOnce(undefined) // workflow start
            .mockResolvedValueOnce({ ok: true }) // main invoke
            .mockResolvedValueOnce(undefined); // workflow success

        const result = await tauriInvoke<{ ok: boolean }>("list_patients", { page_size: 25 });

        expect(result).toEqual({ ok: true });
        expect(invoke).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "primary_action",
                    status: "start",
                    route: "/patients/:id",
                    action: "list_patients",
                }),
            }),
        );
        expect(invoke).toHaveBeenNthCalledWith(
            2,
            "list_patients",
            expect.objectContaining({
                page_size: 25,
                pageSize: 25,
            }),
        );
        expect(invoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    status: "success",
                }),
            }),
        );
    });

    it("logs workflow error when invoke fails", async () => {
        vi.mocked(invoke)
            .mockResolvedValueOnce(undefined) // workflow start
            .mockRejectedValueOnce(new Error("boom")) // main invoke
            .mockResolvedValueOnce(undefined); // workflow error

        await expect(tauriInvoke("create_patient", { patient_id: "p-1" })).rejects.toThrow("boom");
        expect(invoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "primary_action",
                    status: "error",
                    action: "create_patient",
                    message: "boom",
                }),
            }),
        );
    });

    it("does not recurse when logging workflow events", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await tauriInvoke("log_workflow_event", {
            event: { workflow: "ui", step: "route_enter", route: "/dashboard" },
        });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("log_workflow_event", {
            event: { workflow: "ui", step: "route_enter", route: "/dashboard" },
        });
    });
});
