/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { listTaskTeamDirectory } from "@/systems/practice-host/controllers/staff.controller";
import {
    countOpenPracticeTasksForMe,
    listPracticeTasksForMe,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { PracticeTicketsPage } from "./practice-tickets";

vi.mock("@/systems/practice-host/controllers/patient.controller", () => ({
    listPatients: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/staff.controller", () => ({
    listStaff: vi.fn(),
    listTaskTeamDirectory: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/practice-task.controller", () => ({
    listPracticeTasksForMe: vi.fn(),
    countOpenPracticeTasksForMe: vi.fn(),
    transitionPracticeTask: vi.fn(),
    listPracticeTaskComments: vi.fn().mockResolvedValue([]),
    addPracticeTaskComment: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Aya M.",
    email: "aya@practice.de",
    role: "RECEPTION",
};

describe("PracticeTickets smoke (G21)", () => {
    it("shows unified Aufgaben inbox (single list)", async () => {
        useAuthStore.setState({ session: REZ_SESSION, sessionChecked: true });
        vi.mocked(listPracticeTasksForMe).mockResolvedValue([
            {
                id: "a1",
                patient_id: "p1",
                kind: "OTHER",
                title: "Test Task",
                body: "Bitte erledigen",
                assignee_role: "RECEPTION",
                assignee_user_id: null,
                created_by: "u-physician",
                treatment_id: null,
                examination_id: null,
                service_name: null,
                total_cost: null,
                payment_id: null,
                done_note: null,
                return_reason: null,
                status: "OPEN",
                legacy_ticket_id: null,
                created_at: "2026-06-07T10:00:00Z",
                updated_at: "2026-06-07T10:00:00Z",
            },
        ]);
        vi.mocked(countOpenPracticeTasksForMe).mockResolvedValue(1);
        vi.mocked(listPatients).mockResolvedValue([
            { id: "p1", name: "Max Mustermann", date_of_birth: "1990-01-01", sex: "MALE" },
        ] as never);
        vi.mocked(listTaskTeamDirectory).mockResolvedValue([
            { id: "u-physician", name: "Dr. Test", role: "PHYSICIAN" },
        ]);

        render(
            <MemoryRouter>
                <PracticeTicketsPage />
            </MemoryRouter>,
        );

        expect(await screen.findByRole("heading", { name: /Practice tasks/i })).toBeInTheDocument();
        expect(screen.getByText("Test Task")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /Practice-Tickets/i })).toBeNull();
    });
});
