import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";

const { tauriInvokeMock } = vi.hoisted(() => ({
    tauriInvokeMock: vi.fn(),
}));
const testGlobal = globalThis as typeof globalThis & {
    __MEDOC_ENABLE_WORKFLOW_IPC__?: boolean;
};

vi.mock("@/systems/shared/transport/tauri-transport", () => ({
    tauriInvoke: tauriInvokeMock,
}));

describe("TauriPracticeAdapter workflow instrumentation", () => {
    beforeEach(() => {
        tauriInvokeMock.mockReset();
        testGlobal.__MEDOC_ENABLE_WORKFLOW_IPC__ = true;
    });

    afterEach(() => {
        testGlobal.__MEDOC_ENABLE_WORKFLOW_IPC__ = undefined;
    });

    it("emits primary_action and success workflow events around IPC calls", async () => {
        tauriInvokeMock.mockImplementation(async (command: string) => {
            if (command === "log_workflow_event") return undefined;
            return { ok: true };
        });
        const adapter = new TauriPracticeAdapter();
        const result = await adapter.invoke<{ ok: boolean }>("list_patienten", {
            patient_id: "pat-1",
            include_archived: false,
        });
        expect(result).toEqual({ ok: true });
        expect(tauriInvokeMock).toHaveBeenCalledTimes(3);
        expect(tauriInvokeMock.mock.calls[0]?.[0]).toBe("log_workflow_event");
        expect(tauriInvokeMock.mock.calls[1]?.[0]).toBe("list_patienten");
        expect(tauriInvokeMock.mock.calls[2]?.[0]).toBe("log_workflow_event");
        expect(tauriInvokeMock.mock.calls[0]?.[1]).toMatchObject({
            step: "primary_action",
            action: "tauri:list_patienten",
            status: "started",
        });
        expect(String(tauriInvokeMock.mock.calls[0]?.[1]?.detail ?? "")).toContain("keys=");
        expect(tauriInvokeMock.mock.calls[2]?.[1]).toMatchObject({
            step: "success",
            action: "tauri:list_patienten",
            status: "ok",
        });
    });

    it("emits error workflow events when IPC command fails", async () => {
        tauriInvokeMock.mockImplementation(async (command: string) => {
            if (command === "log_workflow_event") return undefined;
            throw new Error("boom");
        });
        const adapter = new TauriPracticeAdapter();
        await expect(adapter.invoke("create_patient", { id: "pat-2" })).rejects.toThrow("boom");
        expect(tauriInvokeMock).toHaveBeenCalledTimes(3);
        expect(tauriInvokeMock.mock.calls[2]?.[1]).toMatchObject({
            step: "error",
            action: "tauri:create_patient",
            status: "failed",
        });
    });

    it("does not recurse when bridge command itself is invoked", async () => {
        tauriInvokeMock.mockResolvedValue(undefined);
        const adapter = new TauriPracticeAdapter();
        const payload = { step: "route_enter", route: "/login" };
        await adapter.invoke<void>("log_workflow_event", payload);
        expect(tauriInvokeMock).toHaveBeenCalledTimes(1);
        expect(tauriInvokeMock).toHaveBeenCalledWith("log_workflow_event", payload);
    });
});
