import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/systems/lan/lib/lan-client-config", () => ({
    isLanClientActive: vi.fn(() => false),
}));

vi.mock("@/systems/practice-host/lib/deployment-config", () => ({
    isLanClientOnly: vi.fn(() => false),
}));

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

import { tauriInvoke } from "@/services/tauri.service";
import {
    logWorkflowRouteEnter,
    practiceSystem,
    resetPracticeTransportCache,
} from "./practice-transport";

const WORKFLOW_TELEMETRY_FLAG = "__MEDOC_WORKFLOW_TELEMETRY__";

describe("practice-transport workflow telemetry bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetPracticeTransportCache();
        delete (globalThis as Record<string, unknown>)[WORKFLOW_TELEMETRY_FLAG];
    });

    it("keeps workflow telemetry disabled by default in Vitest", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({ ok: true });
        await practiceSystem.invoke("list_patients");

        expect(tauriInvoke).toHaveBeenCalledTimes(1);
        expect(tauriInvoke).toHaveBeenCalledWith("list_patients", undefined);
    });

    it("emits primary_action and success workflow events when telemetry is enabled", async () => {
        (globalThis as Record<string, unknown>)[WORKFLOW_TELEMETRY_FLAG] = true;
        vi.mocked(tauriInvoke)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ id: "task-1", status: "OPEN" })
            .mockResolvedValueOnce(undefined);

        const result = await practiceSystem.invoke<{ id: string; status: string }>(
            "create_practice_task",
            { id: "task-1" },
        );
        await Promise.resolve();

        expect(result.id).toBe("task-1");
        expect(tauriInvoke).toHaveBeenNthCalledWith(
            1,
            "log_workflow_step",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "service_call",
                    step: "create_practice_task",
                    phase: "primary_action",
                    action: "create_practice_task",
                }),
            }),
        );
        expect(tauriInvoke).toHaveBeenNthCalledWith(2, "create_practice_task", {
            id: "task-1",
        });
        expect(tauriInvoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_step",
            expect.objectContaining({
                event: expect.objectContaining({
                    phase: "success",
                    status: "OPEN",
                }),
            }),
        );
    });

    it("emits error workflow event when a service command rejects", async () => {
        (globalThis as Record<string, unknown>)[WORKFLOW_TELEMETRY_FLAG] = true;
        vi.mocked(tauriInvoke)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(undefined);

        await expect(
            practiceSystem.invoke("create_payment", { id: "pay-1" }),
        ).rejects.toThrow("boom");
        await Promise.resolve();

        expect(tauriInvoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_step",
            expect.objectContaining({
                event: expect.objectContaining({
                    phase: "error",
                    message: "boom",
                    action: "create_payment",
                }),
            }),
        );
    });

    it("emits route_enter workflow event through explicit route logging helper", async () => {
        (globalThis as Record<string, unknown>)[WORKFLOW_TELEMETRY_FLAG] = true;
        vi.mocked(tauriInvoke).mockResolvedValueOnce(undefined);

        await logWorkflowRouteEnter("/appointments");

        expect(tauriInvoke).toHaveBeenCalledWith(
            "log_workflow_step",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ui_route",
                    phase: "route_enter",
                    route: "/appointments",
                    step: "/appointments",
                }),
            }),
        );
    });
});
