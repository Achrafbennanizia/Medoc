// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { subscribeWorkflowSteps, type WorkflowStepEvent } from "@/lib/workflow-log-events";
import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauriInvoke workflow telemetry", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("emits primary_action + success events for regular commands", async () => {
        const seen: WorkflowStepEvent[] = [];
        const stop = subscribeWorkflowSteps((event) => {
            seen.push(event);
        });
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });

        const result = await tauriInvoke<{ ok: boolean }>("set_app_kv", {
            patient_id: "pat-1",
        });

        stop();
        expect(result.ok).toBe(true);
        expect(invoke).toHaveBeenCalledWith("set_app_kv", {
            patient_id: "pat-1",
            patientId: "pat-1",
        });
        expect(seen.map((e) => e.status)).toEqual(["primary_action", "success"]);
        expect(seen.every((e) => e.workflow === "ipc")).toBe(true);
        expect(seen.every((e) => e.action === "set_app_kv")).toBe(true);
    });

    it("emits an error event when IPC fails", async () => {
        const seen: WorkflowStepEvent[] = [];
        const stop = subscribeWorkflowSteps((event) => {
            seen.push(event);
        });
        vi.mocked(invoke).mockRejectedValueOnce(new Error("boom"));

        await expect(
            tauriInvoke("delete_patient", {
                patientId: "pat-2",
            }),
        ).rejects.toThrow("boom");

        stop();
        expect(seen.map((e) => e.status)).toEqual(["primary_action", "error"]);
        expect(seen[1].detail).toContain("boom");
    });

    it("skips workflow telemetry recursion for workflow_log_step", async () => {
        const seen: WorkflowStepEvent[] = [];
        const stop = subscribeWorkflowSteps((event) => {
            seen.push(event);
        });
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await tauriInvoke("workflow_log_step", {
            payload: { workflow: "route", step: "/", status: "route_enter" },
        });

        stop();
        expect(seen).toHaveLength(0);
    });
});
