import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: vi.fn(),
    },
}));

vi.mock("@/systems/shared/transport/tauri-transport", () => ({
    tauriInvoke: vi.fn(),
}));

import { practiceSystem } from "../adapters/practice-transport";
import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import {
    getLogLevel,
    logWorkflowStep,
    normalizeWorkflowRoute,
} from "./logging.controller";

describe("logging.controller workflow bridge", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset();
        vi.mocked(tauriInvoke).mockReset();
    });

    it("normalizes dynamic route segments for workflow logging", () => {
        expect(normalizeWorkflowRoute("/patients/seed-yr-pat-0120")).toBe("/patients/:id");
        expect(
            normalizeWorkflowRoute(
                "/administration/templates/editor/5f47f130-4cbf-4c0f-b4c1-5f8ff3b24782",
            ),
        ).toBe("/administration/templates/editor/:id");
    });

    it("logs workflow steps through tauri bridge", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce(undefined);
        await logWorkflowStep({
            route: "/patients/seed-yr-pat-0120",
            step: "route_enter",
            status: "success",
            action: "navigation",
        });
        expect(tauriInvoke).toHaveBeenCalledWith("log_workflow_step", {
            payload: {
                route: "/patients/:id",
                step: "route_enter",
                status: "success",
                action: "navigation",
                detail: undefined,
            },
        });
    });

    it("does not throw when workflow logging fails", async () => {
        vi.mocked(tauriInvoke).mockRejectedValueOnce(new Error("bridge unavailable"));
        await expect(
            logWorkflowStep({
                route: "/settings",
                step: "error",
                status: "error",
                detail: "timeout",
            }),
        ).resolves.toBeUndefined();
    });

    it("keeps existing logging controls routed via practiceSystem", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce("INFO");
        await expect(getLogLevel()).resolves.toBe("INFO");
        expect(practiceSystem.invoke).toHaveBeenCalledWith("get_log_level");
    });
});
