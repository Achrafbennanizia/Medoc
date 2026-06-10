/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { POSTEINGANG_POLL_MS, POSTEINGANG_UI_ENABLED } from "@/lib/posteingang-config";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import {
    countOpenPraxisAufgabenForMe,
    listPraxisAufgabenForMe,
    transitionPraxisAufgabe,
    type PraxisAufgabe,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { PosteingangPage } from "./posteingang";

vi.mock("@/systems/practice-host/controllers/praxis-aufgabe.controller", () => ({
    listPraxisAufgabenForMe: vi.fn(),
    countOpenPraxisAufgabenForMe: vi.fn(),
    transitionPraxisAufgabe: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Rezeption G21",
    email: "aya@praxis.de",
    rolle: "REZEPTION",
};

const SAMPLE_AUFGABE: PraxisAufgabe = {
    id: "aufg-1",
    patient_id: "pat-1",
    typ: "SONSTIGES",
    titel: "Test Aufgabe",
    body: "Bitte erledigen",
    assignee_role: "REZEPTION",
    assignee_user_id: null,
    created_by: "seed-arzt-001",
    behandlung_id: null,
    untersuchung_id: null,
    leistungsname: null,
    gesamtkosten: null,
    zahlung_id: null,
    erledigt_notiz: null,
    zurueck_begruendung: null,
    status: "IN_BEARBEITUNG",
    legacy_ticket_id: null,
    created_at: "2026-05-31T10:00:00Z",
    updated_at: "2026-05-31T10:00:00Z",
};

function resetAuth() {
    useAuthStore.setState({ session: null, sessionChecked: true });
}

describe.skipIf(!POSTEINGANG_UI_ENABLED)("Posteingang smoke (G21)", () => {
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

    it("REZ can mark in-progress task as erledigt (checklist row 4 proxy)", async () => {
        vi.useRealTimers();
        vi.mocked(listPraxisAufgabenForMe).mockResolvedValue([SAMPLE_AUFGABE]);
        vi.mocked(transitionPraxisAufgabe).mockResolvedValue(undefined);

        render(
            <MemoryRouter>
                <PosteingangPage />
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getByText("Test Aufgabe")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Erledigt-Notiz/i), {
            target: { value: "Kasse erfasst" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Erledigen/i }));
        await act(async () => {
            await Promise.resolve();
        });
        expect(transitionPraxisAufgabe).toHaveBeenCalledWith({
            id: "aufg-1",
            status: "ERLEDIGT_REZEPTION",
            erledigtNotiz: "Kasse erfasst",
        });
    });
});
