import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { recordWorkflowRouteEnter, tauriInvoke } from "@/services/tauri.service";

type TauriWindow = {
    __TAURI_INTERNALS__?: unknown;
    location: { pathname: string };
};

const ORIGINAL_WINDOW = globalThis.window;

function setWindow(win: TauriWindow | undefined) {
    Object.defineProperty(globalThis, "window", {
        value: win,
        configurable: true,
        writable: true,
    });
}

describe("tauri workflow bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        setWindow(ORIGINAL_WINDOW as TauriWindow | undefined);
    });

    it("keeps plain invoke behavior outside tauri runtime", async () => {
        setWindow(undefined);
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });
        const out = await tauriInvoke<{ ok: boolean }>("get_session");
        expect(out).toEqual({ ok: true });
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("get_session", {});
    });

    it("emits primary/success workflow events for tauri commands", async () => {
        setWindow({
            __TAURI_INTERNALS__: {},
            location: { pathname: "/patienten/6aa01f8a-7742-4d5f-a9d0-9f9c6db5cfb9" },
        });

        vi.mocked(invoke).mockImplementation(async (cmd: string) => {
            if (cmd === "get_session") {
                return { ok: true };
            }
            return undefined;
        });

        const out = await tauriInvoke<{ ok: boolean }>("get_session", { patient_id: "pat-1" });
        expect(out).toEqual({ ok: true });

        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === "record_workflow_event");
        expect(workflowCalls).toHaveLength(2);

        const primaryPayload = workflowCalls[0]?.[1] as { event: Record<string, unknown> };
        const successPayload = workflowCalls[1]?.[1] as { event: Record<string, unknown> };
        expect(primaryPayload.event.step).toBe("primary_action");
        expect(primaryPayload.event.route).toBe("/patienten/:id");
        expect(primaryPayload.event.action).toBe("get_session");
        expect(primaryPayload.event.argKeys).toEqual(["patient_id"]);
        expect(successPayload.event.step).toBe("success");
        expect(successPayload.event.outcome).toBe("ok");
    });

    it("logs explicit route-enter telemetry through the workflow bridge", () => {
        setWindow({
            __TAURI_INTERNALS__: {},
            location: { pathname: "/termine" },
        });

        recordWorkflowRouteEnter("/patienten/12345");

        expect(invoke).toHaveBeenCalledWith(
            "record_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "route_enter",
                    route: "/patienten/:id",
                }),
            }),
        );
    });
});
