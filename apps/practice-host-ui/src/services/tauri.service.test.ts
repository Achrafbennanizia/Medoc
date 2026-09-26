import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { tauriInvoke } from "./tauri.service";

function setRoute(pathname: string, search = ""): void {
    Object.assign(globalThis, {
        window: {
            location: { pathname, search },
        },
    });
}

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        // Route is consumed for workflow log metadata.
        setRoute("/patients", "?tab=open");
    });

    it("logs primary_action + success around non-workflow commands", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        invokeMock.mockResolvedValueOnce(["ok"]);
        invokeMock.mockResolvedValueOnce(undefined);

        const result = await tauriInvoke<string[]>("list_patients", { patient_id: "p-1" });
        expect(result).toEqual(["ok"]);
        expect(invokeMock).toHaveBeenCalledTimes(3);

        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_step",
            expect.objectContaining({
                entry: expect.objectContaining({
                    workflow: "tauri_invoke",
                    step: "primary_action",
                    action: "list_patients",
                    route: "/patients?tab=open",
                }),
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "list_patients",
            expect.objectContaining({
                patient_id: "p-1",
                patientId: "p-1",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_step",
            expect.objectContaining({
                entry: expect.objectContaining({
                    step: "success",
                    action: "list_patients",
                }),
            }),
        );
    });

    it("does not recurse when logging command itself is invoked", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await tauriInvoke<void>("log_workflow_step", {
            entry: { workflow: "ui_navigation", route: "/logs", step: "route_enter" },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_step",
            expect.objectContaining({
                entry: expect.objectContaining({
                    workflow: "ui_navigation",
                }),
            }),
        );
    });

    it("logs an error workflow step when invoke fails", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        invokeMock.mockRejectedValueOnce(new Error("boom"));
        invokeMock.mockResolvedValueOnce(undefined);

        await expect(tauriInvoke("list_patients")).rejects.toThrow("boom");
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_step",
            expect.objectContaining({
                entry: expect.objectContaining({
                    step: "error",
                    action: "list_patients",
                    detail: "error:Error",
                }),
            }),
        );
    });
});
