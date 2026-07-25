// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
        window.history.pushState({}, "", "/");
    });

    it("wraps IPC calls with workflow primary/success events", async () => {
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
        window.history.pushState({}, "", "/patienten");
        vi.mocked(invoke)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce(undefined);

        const res = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "pat-1",
            patientId: "pat-explicit",
            maybe: undefined,
        });

        expect(res.ok).toBe(true);
        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(3);
        expect(vi.mocked(invoke).mock.calls[0]).toEqual([
            "log_workflow_event",
            {
                input: expect.objectContaining({
                    stage: "primary_action",
                    action: "ipc_invoke",
                    command: "create_patient",
                    route: "/patienten",
                }),
            },
        ]);
        expect(vi.mocked(invoke).mock.calls[1]).toEqual([
            "create_patient",
            expect.objectContaining({
                patient_id: "pat-1",
                patientId: "pat-explicit",
            }),
        ]);
        expect(vi.mocked(invoke).mock.calls[1][1]).not.toHaveProperty("maybe");
        expect(vi.mocked(invoke).mock.calls[2]).toEqual([
            "log_workflow_event",
            {
                input: expect.objectContaining({
                    stage: "success",
                    action: "ipc_invoke",
                    command: "create_patient",
                    route: "/patienten",
                }),
            },
        ]);
    });

    it("logs workflow error stage and rethrows invoke errors", async () => {
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
        vi.mocked(invoke)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("boom token=abc"))
            .mockResolvedValueOnce(undefined);

        await expect(tauriInvoke("sync_run_now")).rejects.toThrow("boom token=abc");
        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(3);
        expect(vi.mocked(invoke).mock.calls[2]).toEqual([
            "log_workflow_event",
            {
                input: expect.objectContaining({
                    stage: "error",
                    action: "ipc_invoke",
                    command: "sync_run_now",
                }),
            },
        ]);
    });

    it("writes route_enter events through workflow channel", async () => {
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await logWorkflowRouteEnter("/login");
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("log_workflow_event", {
            input: {
                stage: "route_enter",
                route: "/login",
            },
        });
    });

    it("skips workflow logs when tauri runtime is unavailable", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });

        await tauriInvoke<{ ok: boolean }>("get_session");
        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_session", {});
    });
});
