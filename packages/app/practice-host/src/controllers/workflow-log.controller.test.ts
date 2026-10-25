// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@/systems/practice-host/adapters/tauri-practice.adapter", () => ({
    practiceSystem: {
        invoke: invokeMock,
    },
}));

import { emitWorkflowEvent, recordRouteEnter } from "./workflow-log.controller";

function enableTauriRuntimeFlag() {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {},
        configurable: true,
    });
}

describe("workflow-log.controller", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        enableTauriRuntimeFlag();
    });

    it("normalizes route ids and query values when logging route entry", async () => {
        recordRouteEnter(
            "/patients/123456/charts/550e8400-e29b-41d4-a716-446655440000",
            "?tab=overview&patient=alice",
        );
        await Promise.resolve();

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            event: {
                phase: "route_enter",
                route: "/patients/:id/charts/:id?patient&tab",
                status: "enter",
                action: undefined,
                detail: undefined,
                durationMs: undefined,
            },
        });
    });

    it("redacts secrets and JWTs before sending workflow details", async () => {
        await emitWorkflowEvent({
            phase: "primary_action",
            action: "login",
            status: "error",
            detail: "password=hunter2 token:abc123 eyJhbGciOiJIUzI1NiJ9.payload.sig",
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        const payload = invokeMock.mock.calls[0]?.[1] as {
            event: { detail?: string };
        };
        expect(payload.event.detail).toContain("password=***");
        expect(payload.event.detail).toContain("token=***");
        expect(payload.event.detail).toContain("eyJ***");
        expect(payload.event.detail).not.toContain("hunter2");
        expect(payload.event.detail).not.toContain("abc123");
    });
});
