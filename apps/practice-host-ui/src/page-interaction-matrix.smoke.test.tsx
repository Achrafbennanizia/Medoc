/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MigrationWizardPage } from "@/views/pages/migration-wizard";
import { useToastStore } from "@/views/components/ui/toast-store";

const { parseGdtFile, inspectDicomFile, scannerListRecent, scannerAttach, openSystemScanUtility } = vi.hoisted(() => ({
    parseGdtFile: vi.fn(),
    inspectDicomFile: vi.fn(),
    scannerListRecent: vi.fn(),
    scannerAttach: vi.fn(),
    openSystemScanUtility: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/system.controller", () => ({
    parseGdtFile,
    inspectDicomFile,
    scannerListRecent,
    scannerAttach,
    openSystemScanUtility,
}));

afterEach(() => {
    cleanup();
    useToastStore.setState({ toasts: [], toastStackPointerInside: false });
});

beforeEach(() => {
    parseGdtFile.mockReset();
    inspectDicomFile.mockReset();
    scannerListRecent.mockReset();
    scannerAttach.mockReset();
    openSystemScanUtility.mockReset();
});

async function advanceStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Weiter/i }));
}

describe("Migration page interaction matrix", () => {
    it("supports checkbox-gated progress and keyboard navigation", async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <MigrationWizardPage />
            </MemoryRouter>,
        );

        const next = screen.getByRole("button", { name: /Weiter/i });
        expect(next).toBeDisabled();

        await user.click(screen.getByRole("checkbox"));
        expect(next).not.toBeDisabled();

        next.focus();
        await user.keyboard("{Enter}");
        expect(await screen.findByText(/2 · Export/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /^Zurück$/i }));
        expect(await screen.findByText(/1 · Backup/i)).toBeInTheDocument();
    });

    it("handles input/change/loading/error on device import panel", async () => {
        const user = userEvent.setup();
        let resolveGdt: ((value: unknown) => void) | null = null;

        parseGdtFile.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveGdt = resolve;
                }),
        );

        render(
            <MemoryRouter>
                <MigrationWizardPage />
            </MemoryRouter>,
        );

        await advanceStep(user);
        await advanceStep(user);

        const gdtInput = await screen.findByLabelText(/GDT-Datei \(Pfad\)/i);
        await user.type(gdtInput, "/tmp/export.gdt");

        const runButton = screen.getByRole("button", { name: /GDT prüfen/i });
        await user.click(runButton);
        expect(parseGdtFile).toHaveBeenCalledWith("/tmp/export.gdt");
        expect(runButton).toBeDisabled();

        resolveGdt?.({
            satzart: "6301",
            patient_id: "seed-pat-001",
            patient_name: "Demo",
            patient_first_name: "Max",
            geburtsdatum: null,
            befund: null,
            raw_lines: [],
        });

        await waitFor(() => expect(runButton).not.toBeDisabled());
        expect(screen.getByText(/satzart/i)).toBeInTheDocument();

        parseGdtFile.mockRejectedValueOnce(new Error("kaputt"));
        await user.clear(gdtInput);
        await user.type(gdtInput, "/tmp/fail.gdt");
        await user.click(runButton);

        await waitFor(() =>
            expect(
                useToastStore
                    .getState()
                    .toasts.some((toast) => toast.message.includes("GDT-Fehler")),
            ).toBe(true),
        );
    });
});
