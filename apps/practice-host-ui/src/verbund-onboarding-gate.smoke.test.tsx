/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { VERBUND_STATUS_READY, useVerbundStore } from "@/models/store/verbund-store";
import { VerbundOnboardingGate } from "@/views/components/verbund-onboarding-gate";

const { verbundGetStatus } = vi.hoisted(() => ({
    verbundGetStatus: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/verbund.controller", () => ({
    verbundGetStatus,
}));

function renderGate() {
    return render(
        <MemoryRouter initialEntries={["/login"]}>
            <VerbundOnboardingGate>
                <div>Login Surface</div>
            </VerbundOnboardingGate>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    verbundGetStatus.mockReset();
    useVerbundStore.setState({ status: null } as never);
});

afterEach(() => {
    cleanup();
});

describe("VerbundOnboardingGate", () => {
    it("shows retry/error branch and can continue without Verbund", async () => {
        const user = userEvent.setup();
        verbundGetStatus.mockRejectedValueOnce(new Error("offline"));

        renderGate();

        expect(screen.getByRole("status")).toHaveTextContent("Verbund-Status wird geladen");
        expect(await screen.findByRole("alert")).toHaveTextContent("Verbund-Status konnte nicht geladen werden.");

        await user.click(screen.getByRole("button", { name: /Ohne Verbund fortfahren/i }));
        expect(await screen.findByText("Login Surface")).toBeInTheDocument();
    });

    it("retries status loading from the error branch", async () => {
        const user = userEvent.setup();
        verbundGetStatus
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(VERBUND_STATUS_READY);

        renderGate();

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Erneut versuchen/i }));

        await waitFor(() => {
            expect(screen.getByText("Login Surface")).toBeInTheDocument();
        });
    });
});
