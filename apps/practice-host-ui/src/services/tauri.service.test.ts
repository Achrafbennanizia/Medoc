import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import { logRouteEnter, tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("normalizes invoke args and emits workflow start/success events", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return null;
            return { ok: true };
        });

        await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "pat-1",
            passthroughValue: 7,
            omitted: undefined,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const commandCall = vi
            .mocked(invoke)
            .mock.calls.find(([cmd]) => cmd === "create_patient");
        expect(commandCall?.[1]).toEqual(
            expect.objectContaining({
                patient_id: "pat-1",
                patientId: "pat-1",
                passthroughValue: 7,
                passthrough_value: 7,
            }),
        );
        expect(commandCall?.[1]).not.toHaveProperty("omitted");

        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === "log_workflow_event");
        expect(workflowCalls.length).toBeGreaterThanOrEqual(2);
        expect(
            workflowCalls.some(
                ([, payload]) =>
                    (payload as { event: { status: string } }).event.status ===
                    "start",
            ),
        ).toBe(true);
        expect(
            workflowCalls.some(
                ([, payload]) =>
                    (payload as { event: { status: string } }).event.status ===
                    "success",
            ),
        ).toBe(true);
    });

    it("does not recurse when logging bridge command is invoked directly", async () => {
        vi.mocked(invoke).mockResolvedValue(null);
        await tauriInvoke("log_workflow_event", {
            event: { workflow: "x", step: "y" },
        });
        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
    });

    it("emits route-enter workflow events", async () => {
        vi.mocked(invoke).mockResolvedValue(null);
        logRouteEnter("/login");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(vi.mocked(invoke)).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "route-navigation",
                    step: "route_enter",
                    route: "/login",
                }),
            }),
        );
    });
});
