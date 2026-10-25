import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import { logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits workflow primary/success events around command invokes", async () => {
        invokeMock.mockImplementation(async (command) => {
            if (command === "log_workflow_event") return undefined;
            if (command === "list_patients") return { ok: true };
            throw new Error(`unexpected command: ${command}`);
        });

        await expect(tauriInvoke<{ ok: boolean }>("list_patients", { patient_id: "p-1" })).resolves.toEqual({
            ok: true,
        });

        expect(invokeMock).toHaveBeenNthCalledWith(1, "log_workflow_event", {
            event: { step: "primary_action", action: "list_patients" },
        });
        expect(invokeMock).toHaveBeenNthCalledWith(2, "list_patients", {
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(invokeMock).toHaveBeenNthCalledWith(3, "log_workflow_event", {
            event: { step: "success", action: "list_patients" },
        });
    });

    it("maps cancellation-like command failures to a cancel workflow event", async () => {
        invokeMock.mockImplementation(async (command) => {
            if (command === "log_workflow_event") return undefined;
            if (command === "pick_export_directory") throw new Error("user cancelled picker");
            throw new Error(`unexpected command: ${command}`);
        });

        await expect(tauriInvoke("pick_export_directory")).rejects.toThrow("user cancelled picker");

        expect(invokeMock).toHaveBeenNthCalledWith(1, "log_workflow_event", {
            event: { step: "primary_action", action: "pick_export_directory" },
        });
        expect(invokeMock).toHaveBeenNthCalledWith(3, "log_workflow_event", {
            event: {
                step: "cancel",
                action: "pick_export_directory",
                detail: "user cancelled picker",
            },
        });
    });

    it("logs route transitions via workflow route_enter events", async () => {
        invokeMock.mockResolvedValue(undefined);

        logWorkflowRouteEnter("/patients?tab=active");

        await vi.waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
                event: { step: "route_enter", route: "/patients?tab=active" },
            });
        });
    });

    it("does not recurse when invoking the workflow logger command directly", async () => {
        invokeMock.mockResolvedValue(undefined);

        await expect(
            tauriInvoke<void>("log_workflow_event", {
                event: { step: "route_enter", route: "/settings" },
            }),
        ).resolves.toBeUndefined();

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            event: { step: "route_enter", route: "/settings" },
        });
    });
});
