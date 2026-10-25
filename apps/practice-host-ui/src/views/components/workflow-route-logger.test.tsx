// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRouteLogger } from "./workflow-route-logger";
import { emitWorkflowEvent } from "@/services/tauri.service";

vi.mock("@/services/tauri.service", () => ({
    emitWorkflowEvent: vi.fn().mockResolvedValue(undefined),
}));

function RouteChanger() {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate("/patients?filter=open")}>
            go
        </button>
    );
}

describe("WorkflowRouteLogger", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("emits route_enter events for initial and changed routes", async () => {
        const { getByRole } = render(
            <MemoryRouter initialEntries={["/login"]}>
                <WorkflowRouteLogger />
                <RouteChanger />
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(emitWorkflowEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    stage: "route_enter",
                    workflow: "route",
                    route: "/login",
                }),
            );
        });

        fireEvent.click(getByRole("button", { name: "go" }));

        await waitFor(() => {
            expect(emitWorkflowEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    stage: "route_enter",
                    workflow: "route",
                    route: "/patients",
                    detail: "has_query=true",
                }),
            );
        });
    });
});
