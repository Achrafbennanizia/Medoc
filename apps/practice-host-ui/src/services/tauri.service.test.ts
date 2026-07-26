import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
    __resetWorkflowRouteLogDeduperForTests,
    __setWorkflowBridgeEnabledForTests,
    recordWorkflowRouteEnter,
    tauriInvoke,
} from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("tauri workflow bridge", () => {
    beforeEach(() => {
        mockedInvoke.mockReset();
        __setWorkflowBridgeEnabledForTests(true);
        __resetWorkflowRouteLogDeduperForTests();
    });

    afterEach(() => {
        __setWorkflowBridgeEnabledForTests(null);
    });

    it("logs start/success workflow events around invoke calls", async () => {
        mockedInvoke.mockImplementation(async (cmd) => {
            if (cmd === "create_patient") {
                return { ok: true } as never;
            }
            return undefined as never;
        });

        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "p1",
            keep: undefined,
        });

        expect(result).toEqual({ ok: true });
        expect(mockedInvoke).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "primary_action",
                    command: "create_patient",
                    outcome: "start",
                }),
            }),
        );
        expect(mockedInvoke).toHaveBeenNthCalledWith(2, "create_patient", {
            patient_id: "p1",
            patientId: "p1",
        });
        expect(mockedInvoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "success",
                    command: "create_patient",
                    outcome: "success",
                    duration_ms: expect.any(Number),
                }),
            }),
        );
    });

    it("classifies user-cancelled failures as cancel events", async () => {
        mockedInvoke.mockImplementation(async (cmd) => {
            if (cmd === "open_native_print_dialog") {
                throw new Error("User cancelled dialog");
            }
            return undefined as never;
        });

        await expect(tauriInvoke("open_native_print_dialog")).rejects.toThrow(
            "User cancelled dialog",
        );
        expect(mockedInvoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "cancel",
                    outcome: "cancel",
                    command: "open_native_print_dialog",
                    error_class: "cancelled",
                }),
            }),
        );
    });

    it("normalizes dynamic routes and deduplicates rapid route-enter logs", async () => {
        mockedInvoke.mockResolvedValue(undefined as never);

        await recordWorkflowRouteEnter("/patienten/pat-123/rezept/neu?focus=1");
        await recordWorkflowRouteEnter("/patienten/pat-123/rezept/neu?focus=1");

        expect(mockedInvoke).toHaveBeenCalledTimes(1);
        expect(mockedInvoke).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "route_enter",
                    route: "/patienten/:param/rezept/neu",
                    action: "enter",
                }),
            }),
        );
    });

    it("does not recurse when explicitly logging workflow events", async () => {
        mockedInvoke.mockResolvedValue(undefined as never);

        await tauriInvoke("log_workflow_event", {
            payload: { step: "route_enter" },
        });

        expect(mockedInvoke).toHaveBeenCalledTimes(1);
        expect(mockedInvoke).toHaveBeenCalledWith("log_workflow_event", {
            payload: { step: "route_enter" },
        });
    });
});
