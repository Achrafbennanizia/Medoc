/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
    listChartsToValidate,
    validatePatientChart,
    type ChartToValidateRow,
} from "@/systems/practice-host/controllers/chart-workflow.controller";
import { ChartsToValidatePage } from "./charts-to-validate";

vi.mock("@/systems/practice-host/controllers/chart-workflow.controller", () => ({
    listChartsToValidate: vi.fn(),
    validatePatientChart: vi.fn(),
    countChartsToValidate: vi.fn(),
}));

const SAMPLE_ROW: ChartToValidateRow = {
    patient_id: "pat-queue-1",
    patient_name: "Max Sample",
    chart_id: "chart-queue-1",
    chart_status: "IN_PROGRESS",
    updated_at: "2026-06-10 14:30:00",
};

describe("ChartsToValidatePage", () => {
    beforeEach(() => {
        vi.mocked(listChartsToValidate).mockReset();
        vi.mocked(validatePatientChart).mockReset();
    });

    it("loads queue from IPC and validates a record", async () => {
        vi.mocked(listChartsToValidate)
            .mockResolvedValueOnce([SAMPLE_ROW])
            .mockResolvedValueOnce([]);

        render(
            <MemoryRouter>
                <ChartsToValidatePage />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Max Sample")).toBeTruthy();
        expect(screen.getByText("In progress")).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Validate" }));
        });

        await waitFor(() => {
            expect(validatePatientChart).toHaveBeenCalledWith("pat-queue-1");
        });
        await waitFor(() => {
            expect(listChartsToValidate).toHaveBeenCalledTimes(2);
        });
    });

    it("shows empty state when queue is empty", async () => {
        vi.mocked(listChartsToValidate).mockResolvedValue([]);

        render(
            <MemoryRouter>
                <ChartsToValidatePage />
            </MemoryRouter>,
        );

        expect(await screen.findByText("No records in the validation queue")).toBeTruthy();
    });
});
