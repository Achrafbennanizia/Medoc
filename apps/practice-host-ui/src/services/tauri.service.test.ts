import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { reportWorkflowEvent, tauriInvoke } from "./tauri.service";

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("emits primary_action and success workflow events around command calls", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action log
            .mockResolvedValueOnce({ ok: true }) // command result
            .mockResolvedValueOnce(undefined); // success log

        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "p-1",
            optional: undefined,
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(3);

        expect(invokeMock.mock.calls[0]?.[0]).toBe("log_workflow_event");
        expect(invokeMock.mock.calls[0]?.[1]).toMatchObject({
            event: expect.objectContaining({
                workflow: "tauri-command",
                step: "primary_action",
                status: "start",
                action: "create_patient",
            }),
        });

        expect(invokeMock.mock.calls[1]?.[0]).toBe("create_patient");
        expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(invokeMock.mock.calls[1]?.[1]).not.toHaveProperty("optional");

        expect(invokeMock.mock.calls[2]?.[0]).toBe("log_workflow_event");
        expect(invokeMock.mock.calls[2]?.[1]).toMatchObject({
            event: expect.objectContaining({
                step: "success",
                status: "success",
                action: "create_patient",
            }),
        });
    });

    it("classifies cancellation-like errors as cancel workflow steps", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action log
            .mockRejectedValueOnce(new Error("User cancelled dialog")) // command
            .mockResolvedValueOnce(undefined); // cancel log

        await expect(tauriInvoke("open_native_print_dialog")).rejects.toThrow(
            "User cancelled dialog",
        );

        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock.mock.calls[2]?.[0]).toBe("log_workflow_event");
        expect(invokeMock.mock.calls[2]?.[1]).toMatchObject({
            event: expect.objectContaining({
                step: "cancel",
                status: "cancelled",
                action: "open_native_print_dialog",
            }),
        });
    });

    it("sends explicit route events through reportWorkflowEvent", async () => {
        invokeMock.mockResolvedValueOnce(undefined);

        await reportWorkflowEvent({
            workflow: "ui-navigation",
            step: "route_enter",
            route: "/login",
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ui-navigation",
                    step: "route_enter",
                    route: "/login",
                }),
            }),
        );
    });

    it("does not recurse when workflow bridge command is invoked directly", async () => {
        invokeMock.mockResolvedValueOnce(undefined);

        await tauriInvoke("log_workflow_event", { event: { workflow: "x", step: "y" } });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock.mock.calls[0]?.[0]).toBe("log_workflow_event");
    });
});
