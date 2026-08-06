import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { logUiRouteEnter, tauriInvoke } from "@/services/tauri.service";

const tauriGlobal = globalThis as typeof globalThis & {
    __MEDOC_FORCE_TAURI_RUNTIME__?: boolean;
};

describe("tauri.service workflow logging bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tauriGlobal.__MEDOC_FORCE_TAURI_RUNTIME__ = true;
    });

    it("emits primary_action and success workflow events for IPC calls", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") return undefined as never;
            return { ok: true } as never;
        });

        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "p-1",
            quickFlag: true,
            ignored: undefined,
        });
        expect(result).toEqual({ ok: true });

        const commandCall = vi
            .mocked(invoke)
            .mock.calls.find(([cmd]) => cmd === "create_patient");
        expect(commandCall).toBeTruthy();
        expect(commandCall?.[1]).toMatchObject({
            patient_id: "p-1",
            patientId: "p-1",
            quickFlag: true,
            quick_flag: true,
        });
        expect(commandCall?.[1]).not.toHaveProperty("ignored");

        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === "log_workflow_event")
            .map(([, args]) => args as { event: { phase: string } });
        expect(workflowCalls.some((call) => call.event.phase === "primary_action")).toBe(true);
        expect(workflowCalls.some((call) => call.event.phase === "success")).toBe(true);
    });

    it("maps invoke cancellation errors to workflow cancel events", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") return undefined as never;
            throw new Error("operation cancelled by user");
        });

        await expect(tauriInvoke("delete_patient", { patient_id: "p-1" })).rejects.toThrow(
            /cancelled/i,
        );

        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === "log_workflow_event")
            .map(([, args]) => args as { event: { phase: string; status: string; detail: string } });
        expect(
            workflowCalls.some(
                (call) =>
                    call.event.phase === "cancel" &&
                    call.event.status === "cancelled" &&
                    call.event.detail === "invoke_cancelled",
            ),
        ).toBe(true);
    });

    it("emits route_enter workflow events", () => {
        vi.mocked(invoke).mockResolvedValue(undefined as never);
        logUiRouteEnter("/termine/neu");
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("log_workflow_event", {
            event: expect.objectContaining({
                workflow: "route:/termine/neu",
                phase: "route_enter",
            }),
        });
    });
});
