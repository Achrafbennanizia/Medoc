/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { listPhysicians } from "@/systems/practice-host/controllers/staff.controller";
import { PatientChartWorkflowDialogs } from "./patient-chart-workflow-dialogs";

vi.mock("@/systems/practice-host/controllers/practice-task.controller", () => ({
    createPracticeTask: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/staff.controller", () => ({
    listPhysicians: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/chart-workflow.controller", () => ({
    forwardChartToPhysicians: vi.fn(),
}));

describe("PatientChartWorkflowDialogs smoke (G21 row 3 proxy)", () => {
    it("PHYSICIAN creates Task an Reception via dialog", async () => {
        vi.mocked(listPhysicians).mockResolvedValue([{ id: "physician-1", name: "Dr. A." }]);
        vi.mocked(createPracticeTask).mockResolvedValue(undefined);
        const toast = vi.fn();
        const onClose = vi.fn();

        render(
            <PatientChartWorkflowDialogs
                mode="task"
                onClose={onClose}
                patientId="pat-1"
                currentUserId="physician-1"
                role="PHYSICIAN"
                toast={toast}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText(/Reception \(pool\)/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/schedule appointment/i), {
            target: { value: "Rückruf Patient" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Create/i }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(createPracticeTask).toHaveBeenCalledWith({
            patientId: "pat-1",
            kind: "OTHER",
            title: "Rückruf Patient",
            body: null,
            assigneeUserId: null,
            assigneeRole: "RECEPTION",
        });
        expect(toast).toHaveBeenCalledWith("Task created for reception (pool).", "success");
        expect(onClose).toHaveBeenCalled();
    });
});
