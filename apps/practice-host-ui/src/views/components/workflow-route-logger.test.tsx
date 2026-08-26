// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { WorkflowRouteLogger } from "./workflow-route-logger";
import { recordWorkflowEvent } from "@/services/tauri.service";

vi.mock("@/services/tauri.service", () => ({
    recordWorkflowEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("WorkflowRouteLogger", () => {
    beforeEach(() => {
        vi.mocked(recordWorkflowEvent).mockClear();
    });

    it("records route enter events from router location", async () => {
        render(
            <MemoryRouter initialEntries={["/login?locale=en"]}>
                <WorkflowRouteLogger />
            </MemoryRouter>,
        );

        await waitFor(() =>
            expect(recordWorkflowEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    stage: "route_enter",
                    route: "/login?locale=en",
                    action: "route_navigation",
                }),
            ),
        );
    });
});
