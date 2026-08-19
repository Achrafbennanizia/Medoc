/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MigrationWizardPage } from "@/views/pages/migration-wizard";
import { SettingsMigrationSection } from "@/systems/practice-host/pages/settings/settings-migration-section";
import { SettingsDeploymentSection } from "@/systems/practice-host/pages/settings/settings-deployment-section";

vi.mock("@/systems/practice-host/controllers/sync.controller", () => ({
    syncGetStatus: vi.fn().mockResolvedValue({
        localDeviceId: "smoke",
        deployment: {
            schemaVersion: 1,
            mode: "serverless_peer",
            role: "MASTER",
            masterBaseUrl: "",
            masterCertSha256: "",
            masterAccessToken: "",
            deviceLabel: "Smoke",
            activationToken: "",
            masterPubkey: "",
            masterDeviceId: "",
            pairingRequestId: "",
            unstableMesh: false,
        },
        localSeq: 0,
        pendingOutbox: 0,
        peers: [],
        vectors: {},
    }),
    syncSetDeployment: vi.fn(),
    syncRunNow: vi.fn(),
}));

vi.mock("@/systems/practice-host/controllers/pairing.controller", () => ({
    pairingMasterInfo: vi.fn().mockResolvedValue({
        masterDeviceId: "master-smoke",
        masterPubkey: "pk-smoke",
    }),
}));

vi.mock("@/systems/practice-host/controllers/settings-page.controller", async (importOriginal) => {
    const orig = await importOriginal<typeof import("@/systems/practice-host/controllers/settings-page.controller")>();
    return {
        ...orig,
        lanServerStatus: vi.fn().mockResolvedValue({
            running: false,
            bindAddr: null,
            httpPort: null,
            discoveryPort: null,
            instanceLabel: null,
            suggestedBaseUrls: [],
            tlsCertSha256: null,
        }),
        lanServerStart: vi.fn(),
        lanServerStop: vi.fn(),
    };
});

afterEach(() => {
    cleanup();
});

describe("P0 routes smoke (T-U3)", () => {
    it("migration wizard shows MVP CSV-only intro (UX-5 / W9)", () => {
        render(
            <MemoryRouter>
                <MigrationWizardPage />
            </MemoryRouter>,
        );
        expect(screen.getByRole("heading", { name: /Data migration/i })).toBeInTheDocument();
        expect(screen.getByText(/MVP v0\.1.*CSV/i)).toBeInTheDocument();
    });

    it("settings migration section links to wizard (W9)", () => {
        render(
            <MemoryRouter>
                <SettingsMigrationSection canMigration />
            </MemoryRouter>,
        );
        expect(screen.getByText(/MVP v0\.1.*CSV/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Go to data migration/i })).toBeInTheDocument();
    });

    it("deployment section focuses on serverless connection (W7)", async () => {
        render(
            <MemoryRouter>
                <SettingsDeploymentSection />
            </MemoryRouter>,
        );
        expect(await screen.findByText(/Serverless connection/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Device role/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Betriebsmodus/i)).not.toBeInTheDocument();
    });
});
