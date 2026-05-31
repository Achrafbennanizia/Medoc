/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { listPraxisTicketsForMe } from "@/systems/practice-host/controllers/akte-workflow.controller";
import { PraxisTicketsPage } from "./praxis-tickets";

vi.mock("@/systems/practice-host/controllers/akte-workflow.controller", () => ({
    listPraxisTicketsForMe: vi.fn(),
    updatePraxisTicketStatus: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Aya M.",
    email: "aya@praxis.de",
    rolle: "REZEPTION",
};

describe("PraxisTickets smoke (G21)", () => {
    it("shows Posteingang banner link (checklist row 8)", async () => {
        useAuthStore.setState({ session: REZ_SESSION, sessionChecked: true });
        vi.mocked(listPraxisTicketsForMe).mockResolvedValue([]);

        render(
            <MemoryRouter>
                <PraxisTicketsPage />
            </MemoryRouter>,
        );

        const link = await screen.findByRole("link", { name: /posteingang/i });
        expect(link).toHaveAttribute("href", "/posteingang");
    });
});
