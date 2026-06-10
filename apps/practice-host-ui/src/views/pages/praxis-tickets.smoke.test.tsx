/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listAufgabeTeamDirectory } from "@/systems/practice-host/controllers/personal.controller";
import {
    countOpenPraxisAufgabenForMe,
    listPraxisAufgabenForMe,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { PraxisTicketsPage } from "./praxis-tickets";

vi.mock("@/systems/practice-host/controllers/patient.controller", () => ({
    listPatienten: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/personal.controller", () => ({
    listPersonal: vi.fn(),
    listAufgabeTeamDirectory: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/praxis-aufgabe.controller", () => ({
    listPraxisAufgabenForMe: vi.fn(),
    countOpenPraxisAufgabenForMe: vi.fn(),
    transitionPraxisAufgabe: vi.fn(),
    listPraxisAufgabeKommentare: vi.fn().mockResolvedValue([]),
    addPraxisAufgabeKommentar: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Aya M.",
    email: "aya@praxis.de",
    rolle: "REZEPTION",
};

describe("PraxisTickets smoke (G21)", () => {
    it("shows unified Aufgaben inbox (single list)", async () => {
        useAuthStore.setState({ session: REZ_SESSION, sessionChecked: true });
        vi.mocked(listPraxisAufgabenForMe).mockResolvedValue([
            {
                id: "a1",
                patient_id: "p1",
                typ: "SONSTIGES",
                titel: "Test Aufgabe",
                body: "Bitte erledigen",
                assignee_role: "REZEPTION",
                assignee_user_id: null,
                created_by: "u-arzt",
                behandlung_id: null,
                untersuchung_id: null,
                leistungsname: null,
                gesamtkosten: null,
                zahlung_id: null,
                erledigt_notiz: null,
                zurueck_begruendung: null,
                status: "OFFEN",
                legacy_ticket_id: null,
                created_at: "2026-06-07T10:00:00Z",
                updated_at: "2026-06-07T10:00:00Z",
            },
        ]);
        vi.mocked(countOpenPraxisAufgabenForMe).mockResolvedValue(1);
        vi.mocked(listPatienten).mockResolvedValue([
            { id: "p1", name: "Max Mustermann", geburtsdatum: "1990-01-01", geschlecht: "MAENNLICH" },
        ] as never);
        vi.mocked(listAufgabeTeamDirectory).mockResolvedValue([
            { id: "u-arzt", name: "Dr. Test", rolle: "ARZT" },
        ]);

        render(
            <MemoryRouter>
                <PraxisTicketsPage />
            </MemoryRouter>,
        );

        expect(await screen.findByRole("heading", { name: /Praxis-Aufgaben/i })).toBeInTheDocument();
        expect(screen.getByText("Test Aufgabe")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /Praxis-Tickets/i })).toBeNull();
    });
});
