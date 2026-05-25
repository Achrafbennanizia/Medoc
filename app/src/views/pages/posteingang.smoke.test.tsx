/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { POSTEINGANG_POLL_MS } from "@/lib/posteingang-config";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import {
    countOpenPraxisAufgabenForMe,
    listPraxisAufgabenForMe,
} from "@/controllers/praxis-aufgabe.controller";
import { PosteingangPage } from "./posteingang";

vi.mock("@/controllers/praxis-aufgabe.controller", () => ({
    listPraxisAufgabenForMe: vi.fn(),
    countOpenPraxisAufgabenForMe: vi.fn(),
    transitionPraxisAufgabe: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Rezeption G21",
    email: "rez@medoc.test",
    rolle: "REZEPTION",
};

function resetAuth() {
    useAuthStore.setState({ session: null, sessionChecked: true });
}

describe("Posteingang smoke (G21)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetAuth();
        useAuthStore.setState({ session: REZ_SESSION, sessionChecked: true });
        vi.mocked(listPraxisAufgabenForMe).mockResolvedValue([]);
        vi.mocked(countOpenPraxisAufgabenForMe).mockResolvedValue(0);
    });

    afterEach(() => {
        vi.useRealTimers();
        resetAuth();
        vi.clearAllMocks();
    });

    it("loads aufgaben and polls on FA-AUFG-03 interval", async () => {
        render(
            <MemoryRouter>
                <PosteingangPage />
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(listPraxisAufgabenForMe).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/Keine offenen Aufgaben/i)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(POSTEINGANG_POLL_MS);
        });
        expect(listPraxisAufgabenForMe).toHaveBeenCalledTimes(2);
    });
});
