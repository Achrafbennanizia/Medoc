// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { tauriInvoke } from "./tauri.service";

function enableTauriRuntimeFlag() {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {},
        configurable: true,
    });
}

describe("tauri.service", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        enableTauriRuntimeFlag();
    });

    it("logs primary-action start/success around command invoke", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return undefined;
            return { ok: true };
        });

        const result = await tauriInvoke<{ ok: boolean }>("get_patient", { patient_id: "p-1" });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenNthCalledWith(1, "log_workflow_event", {
            event: {
                phase: "primary_action",
                action: "get_patient",
                status: "start",
            },
        });
        expect(invokeMock).toHaveBeenNthCalledWith(2, "get_patient", {
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    phase: "primary_action",
                    action: "get_patient",
                    status: "success",
                }),
            }),
        );
    });

    it("logs sanitized error details on invoke failure", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return undefined;
            throw new Error("password=hunter2 token=abc eyJhbGciOiJIUzI1NiJ9.payload.sig");
        });

        await expect(tauriInvoke("login", { email: "demo@practice.de" })).rejects.toThrow(
            "password=hunter2",
        );

        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    phase: "primary_action",
                    action: "login",
                    status: "error",
                    detail: "Error: password=*** token=*** eyJ***",
                }),
            }),
        );
    });

    it("does not recursively wrap workflow logging command", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", {
            event: { phase: "route_enter", route: "/login" },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            event: { phase: "route_enter", route: "/login" },
        });
    });
});
