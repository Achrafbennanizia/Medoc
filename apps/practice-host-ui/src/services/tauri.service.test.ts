// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauriInvoke workflow bridge", () => {
    const invokeMock = vi.mocked(invoke);

    beforeEach(() => {
        invokeMock.mockReset();
        window.history.pushState({}, "", "/termine?day=2026-08-26");
    });

    it("logs primary action and success around invokes", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "record_workflow_event") return undefined as never;
            if (cmd === "sync_get_status") return { ok: true } as never;
            throw new Error(`unexpected command: ${cmd}`);
        });

        const result = await tauriInvoke<{ ok: boolean }>("sync_get_status", {
            patient_id: "patient-1",
            optional: undefined,
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "record_workflow_event",
            expect.objectContaining({
                stage: "primary_action",
                action: "sync_get_status",
                route: "/termine?day=2026-08-26",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "sync_get_status",
            expect.objectContaining({
                patient_id: "patient-1",
                patientId: "patient-1",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "record_workflow_event",
            expect.objectContaining({
                stage: "success",
                action: "sync_get_status",
                outcome: "ok",
            }),
        );
    });

    it("logs normalized failures and rethrows invoke errors", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "record_workflow_event") return undefined as never;
            if (cmd === "sync_get_status") throw new Error("401 unauthorized");
            throw new Error(`unexpected command: ${cmd}`);
        });

        await expect(tauriInvoke("sync_get_status")).rejects.toThrow("401 unauthorized");
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "record_workflow_event",
            expect.objectContaining({
                stage: "error",
                action: "sync_get_status",
                outcome: "unauthorized",
            }),
        );
    });

    it("does not recursively self-log workflow log command", async () => {
        invokeMock.mockResolvedValue(undefined as never);

        await tauriInvoke("record_workflow_event", {
            stage: "route_enter",
            route: "/login",
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "record_workflow_event",
            expect.objectContaining({
                stage: "route_enter",
                route: "/login",
            }),
        );
    });
});
