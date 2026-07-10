/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
    listAktenZuValidieren,
    validatePatientenakte,
    type AkteZuValidierenRow,
} from "@/systems/practice-host/controllers/akte-workflow.controller";
import { AktenZuValidierenPage } from "./akten-zu-validieren";

vi.mock("@/systems/practice-host/controllers/akte-workflow.controller", () => ({
    listAktenZuValidieren: vi.fn(),
    validatePatientenakte: vi.fn(),
    countAktenZuValidieren: vi.fn(),
}));

const SAMPLE_ROW: AkteZuValidierenRow = {
    patient_id: "pat-queue-1",
    patient_name: "Max Mustermann",
    akte_id: "akte-queue-1",
    akte_status: "IN_BEARBEITUNG",
    updated_at: "2026-06-10 14:30:00",
};

describe("AktenZuValidierenPage", () => {
    beforeEach(() => {
        vi.mocked(listAktenZuValidieren).mockReset();
        vi.mocked(validatePatientenakte).mockReset();
    });

    it("loads queue from IPC and validates a record", async () => {
        vi.mocked(listAktenZuValidieren)
            .mockResolvedValueOnce([SAMPLE_ROW])
            .mockResolvedValueOnce([]);

        render(
            <MemoryRouter>
                <AktenZuValidierenPage />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Max Mustermann")).toBeTruthy();
        expect(screen.getByText("In progress")).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Validate" }));
        });

        await waitFor(() => {
            expect(validatePatientenakte).toHaveBeenCalledWith("pat-queue-1");
        });
        await waitFor(() => {
            expect(listAktenZuValidieren).toHaveBeenCalledTimes(2);
        });
    });

    it("shows empty state when queue is empty", async () => {
        vi.mocked(listAktenZuValidieren).mockResolvedValue([]);

        render(
            <MemoryRouter>
                <AktenZuValidierenPage />
            </MemoryRouter>,
        );

        expect(await screen.findByText("No records in the validation queue")).toBeTruthy();
    });
});
