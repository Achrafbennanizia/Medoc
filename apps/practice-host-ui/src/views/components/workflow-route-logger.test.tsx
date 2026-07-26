/** @vitest-environment jsdom */
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitWorkflowEvent } from "@/systems/practice-host/lib/workflow-log";
import { WorkflowRouteLogger } from "./workflow-route-logger";

vi.mock("@/systems/practice-host/lib/workflow-log", () => ({
    emitWorkflowEvent: vi.fn().mockResolvedValue(undefined),
}));

function NavHarness() {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate("/termine?tab=week")}>
            Go Termine
        </button>
    );
}

describe("WorkflowRouteLogger", () => {
    beforeEach(() => {
        vi.mocked(emitWorkflowEvent).mockClear();
    });

    it("emits route_enter for initial route and navigation transitions", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={["/login"]}>
                <WorkflowRouteLogger />
                <Routes>
                    <Route path="/login" element={<NavHarness />} />
                    <Route path="/termine" element={<h1>Termine</h1>} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() =>
            expect(emitWorkflowEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    step: "route_enter",
                    route: "/login",
                }),
            ),
        );

        await user.click(screen.getByRole("button", { name: "Go Termine" }));
        await screen.findByRole("heading", { name: "Termine" });

        await waitFor(() => {
            const lastEvent = vi.mocked(emitWorkflowEvent).mock.calls.at(-1)?.[0];
            expect(lastEvent).toMatchObject({
                step: "route_enter",
                route: "/termine",
                detail: "?tab=week",
            });
        });
    });
});
