import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    emitWorkflowPrimaryAction,
    emitWorkflowRouteEnter,
    emitWorkflowSuccess,
    normalizeWorkflowRoute,
} from "./workflow-logger";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

async function flushMicrotask(): Promise<void> {
    await Promise.resolve();
}

describe("workflow-logger", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(invoke).mockResolvedValue(undefined as never);
    });

    it("normalizes dynamic path segments", () => {
        expect(normalizeWorkflowRoute("/patients/1234567890")).toBe("/patients/:id");
        expect(normalizeWorkflowRoute("/patients/7f4f6a9a-1234-4321-8e90-2ee8adf84ff0")).toBe(
            "/patients/:id",
        );
        expect(normalizeWorkflowRoute("/administration/contracts")).toBe("/administration/contracts");
    });

    it("emits route-enter events with sanitized routes", async () => {
        emitWorkflowRouteEnter("/patients/1234567890?tab=payments");
        await flushMicrotask();
        expect(invoke).toHaveBeenCalledWith(
            "record_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    stage: "route_enter",
                    route: "/patients/:id",
                    source: "frontend_router",
                }),
            }),
        );
    });

    it("emits primary action and success events", async () => {
        emitWorkflowPrimaryAction("create_payment", "corr-1");
        emitWorkflowSuccess("create_payment", "corr-1", 42.2);
        await flushMicrotask();
        expect(invoke).toHaveBeenCalledTimes(2);
        expect(invoke).toHaveBeenNthCalledWith(
            1,
            "record_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    stage: "primary_action",
                    action: "create_payment",
                    correlationId: "corr-1",
                }),
            }),
        );
        expect(invoke).toHaveBeenNthCalledWith(
            2,
            "record_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    stage: "success",
                    action: "create_payment",
                    correlationId: "corr-1",
                    durationMs: 42,
                }),
            }),
        );
    });
});
