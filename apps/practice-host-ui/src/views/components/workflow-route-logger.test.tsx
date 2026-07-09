/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

vi.mock("@/systems/practice-host/lib/workflow-log", () => ({
    logRouteEnter: vi.fn(),
}));

import { logRouteEnter } from "@/systems/practice-host/lib/workflow-log";
import { WorkflowRouteLogger } from "./workflow-route-logger";

function GoNextButton() {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate("/next?tab=1#anchor")}>
            Go next
        </button>
    );
}

afterEach(() => {
    cleanup();
});

describe("WorkflowRouteLogger", () => {
    it("emits route_enter on first render and route changes", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={["/start"]}>
                <WorkflowRouteLogger />
                <Routes>
                    <Route
                        path="/start"
                        element={<GoNextButton />}
                    />
                    <Route path="/next" element={<div>next</div>} />
                </Routes>
            </MemoryRouter>,
        );

        expect(logRouteEnter).toHaveBeenCalledWith("/start");
        await user.click(screen.getByRole("button", { name: "Go next" }));
        expect(logRouteEnter).toHaveBeenLastCalledWith("/next?tab=1#anchor");
    });
});
