/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPraxisAufgabe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { listAerzte } from "@/systems/practice-host/controllers/personal.controller";
import { PatientAkteWorkflowDialogs } from "./patient-akte-workflow-dialogs";

vi.mock("@/systems/practice-host/controllers/praxis-aufgabe.controller", () => ({
    createPraxisAufgabe: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/personal.controller", () => ({
    listAerzte: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/akte-workflow.controller", () => ({
    createPraxisTicket: vi.fn(),
    forwardAkteToPhysicians: vi.fn(),
}));

describe("PatientAkteWorkflowDialogs smoke (G21 row 3 proxy)", () => {
    it("ARZT creates Aufgabe an Rezeption via dialog", async () => {
        vi.mocked(listAerzte).mockResolvedValue([{ id: "arzt-1", name: "Dr. A." }]);
        vi.mocked(createPraxisAufgabe).mockResolvedValue(undefined);
        const toast = vi.fn();
        const onClose = vi.fn();

        render(
            <PatientAkteWorkflowDialogs
                mode="aufgabe"
                onClose={onClose}
                patientId="pat-1"
                currentUserId="arzt-1"
                role="ARZT"
                toast={toast}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText(/Erscheint im Posteingang der Rezeption/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/Termin vereinbaren/i), {
            target: { value: "Rückruf Patient" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Anlegen/i }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(createPraxisAufgabe).toHaveBeenCalledWith({
            patientId: "pat-1",
            typ: "SONSTIGES",
            titel: "Rückruf Patient",
            body: null,
            assigneeRole: "REZEPTION",
        });
        expect(toast).toHaveBeenCalledWith("Aufgabe an Rezeption erstellt.", "success");
        expect(onClose).toHaveBeenCalled();
    });
});
