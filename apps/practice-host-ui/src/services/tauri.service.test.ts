import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import {
    classifyWorkflowFailure,
    normalizeWorkflowPath,
    tauriInvoke,
} from "./tauri.service";

describe("tauri workflow logging bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        delete (globalThis as { __MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__?: boolean })
            .__MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__;
    });

    it("normalizes route paths without leaking ids", () => {
        expect(
            normalizeWorkflowPath(
                "/patienten/123e4567-e89b-12d3-a456-426614174000/rezept/987654",
            ),
        ).toBe("/patienten/:id/rezept/:id");
        expect(normalizeWorkflowPath("/verwaltung/team")).toBe("/verwaltung/team");
    });

    it("classifies abort-like failures as cancel", () => {
        expect(classifyWorkflowFailure(new DOMException("aborted by user", "AbortError"))).toBe(
            "cancel",
        );
        expect(classifyWorkflowFailure(new Error("request cancelled"))).toBe("cancel");
        expect(classifyWorkflowFailure(new Error("validation failed"))).toBe("error");
    });

    it("emits workflow primary/success around regular invoke", async () => {
        (globalThis as { __MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__?: boolean })
            .__MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__ = true;
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action workflow event
            .mockResolvedValueOnce({ ok: true }) // actual IPC command
            .mockResolvedValueOnce(undefined); // success workflow event

        const result = await tauriInvoke<{ ok: boolean }>("get_session", {
            patient_id: "seed-pat-001",
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "primary_action",
                    command: "get_session",
                }),
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "get_session",
            expect.objectContaining({
                patient_id: "seed-pat-001",
                patientId: "seed-pat-001",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "success",
                    command: "get_session",
                }),
            }),
        );
    });

    it("bypasses lifecycle logging for the workflow bridge command itself", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await tauriInvoke("log_workflow_event", {
            event: { step: "route_enter", route: "/" },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({ step: "route_enter" }),
            }),
        );
    });
});
