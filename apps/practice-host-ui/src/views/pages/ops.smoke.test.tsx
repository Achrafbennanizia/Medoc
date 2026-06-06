/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
    listBackups,
    pickBackupFile,
    restoreBackup,
    validateBackup,
} from "@/systems/practice-host/controllers/ops.controller";
import { getAuditChainStatus } from "@/systems/practice-host/controllers/audit-chain.controller";
import { getPerfThresholdMs } from "@/systems/practice-host/controllers/system.controller";
import { OpsPage } from "./ops";

vi.mock("@/systems/practice-host/controllers/ops.controller", () => ({
    createBackup: vi.fn(),
    listBackups: vi.fn(),
    importPatientsCsv: vi.fn(),
    pickBackupFile: vi.fn(),
    pickPatientsCsvFile: vi.fn(),
    restoreBackup: vi.fn(),
    validateBackup: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/audit-chain.controller", () => ({
    getAuditChainStatus: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/system.controller", () => ({
    getPerfThresholdMs: vi.fn(),
    setPerfThresholdMs: vi.fn(),
    systemHealthCheck: vi.fn(),
}));

describe("OpsPage smoke (G21 row 7 proxy)", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("validate backup then restore shows reload hint", async () => {
        vi.mocked(getAuditChainStatus).mockResolvedValue({
            blocks_ops: false,
            broken_at: null,
            acknowledged: true,
        });
        vi.mocked(listBackups).mockResolvedValue([]);
        vi.mocked(getPerfThresholdMs).mockResolvedValue(500);
        vi.mocked(pickBackupFile).mockResolvedValue("/tmp/medoc-backup.db");
        vi.mocked(validateBackup).mockResolvedValue(true);
        vi.mocked(restoreBackup).mockResolvedValue({
            pre_restore_backup_created: true,
            restored_from: "/tmp/medoc-backup.db",
            requires_app_restart: false,
        });

        render(
            <MemoryRouter>
                <OpsPage embedded />
            </MemoryRouter>,
        );

        fireEvent.click(await screen.findByRole("button", { name: /Backup-Datei wählen/i }));
        await waitFor(() => {
            expect(screen.getByText("/tmp/medoc-backup.db")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: /^Prüfen$/i }));
        await waitFor(() => {
            expect(validateBackup).toHaveBeenCalledWith("/tmp/medoc-backup.db");
        });

        fireEvent.click(screen.getByRole("button", { name: /Wiederherstellen/i }));
        const dialog = await screen.findByRole("dialog", { name: /Datenbank wiederherstellen/i });
        fireEvent.click(within(dialog).getByRole("button", { name: /^Wiederherstellen$/i }));

        await waitFor(() => {
            expect(restoreBackup).toHaveBeenCalledWith("/tmp/medoc-backup.db");
        });
        expect(await screen.findByText(/Bitte die Anwendung jetzt neu starten/i)).toBeInTheDocument();
    });
});
