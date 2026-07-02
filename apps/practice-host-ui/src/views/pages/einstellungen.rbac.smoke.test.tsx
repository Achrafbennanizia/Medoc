import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BENACHRICHTIGUNGEN_SETTINGS_ENABLED } from "@/lib/settings-ui-flags";
import { useAuthStore } from "@/models/store/auth-store";
import { EinstellungenPage } from "./einstellungen";

vi.mock("@/systems/practice-host/controllers/settings-page.controller", () => ({
    changePassword: vi.fn(),
    companyPortalFetchFeatureFlags: vi.fn().mockResolvedValue(null),
    companyPortalFetchIntegrations: vi.fn().mockResolvedValue(null),
    companyPortalFetchSummary: vi.fn().mockResolvedValue(null),
    verifyLicense: vi.fn(),
    activateLicense: vi.fn(),
    currentLicenseStatus: vi.fn().mockResolvedValue(null),
    clearLicense: vi.fn(),
}));

vi.mock("@/lib/praxis-praeferenzen-storage", () => ({
    DEFAULT_PRAXIS_PRAEFERENZEN: { pufferMin: "0", notfallPuffer: "0", reminder: "0", noShow: "warn", kalenderDragDropEnabled: false },
    hydratePraxisPraeferenzenFromKv: vi.fn().mockResolvedValue({ pufferMin: "0", notfallPuffer: "0", reminder: "0", noShow: "warn", kalenderDragDropEnabled: false }),
    savePraxisPraeferenzen: vi.fn(),
}));

vi.mock("@/systems/practice-host/pages/einstellungen/einstellungen-konto-section", () => ({
    EinstellungenKontoSection: () => <div data-testid="konto-panel">Konto</div>,
}));

describe("EinstellungenPage RBAC nav", () => {
    beforeEach(() => {
        useAuthStore.setState({
            session: {
                user_id: "u-rezeption",
                name: "Rezeption Test",
                email: "rez@test.de",
                rolle: "REZEPTION",
                permission_overrides: [],
            },
        });
    });

    it("shows only frontdesk settings sections for REZEPTION", () => {
        render(
            <MemoryRouter initialEntries={["/einstellungen"]}>
                <EinstellungenPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole("button", { name: /Account/i })).toBeInTheDocument();
        if (BENACHRICHTIGUNGEN_SETTINGS_ENABLED) {
            expect(screen.getByRole("button", { name: /Notifications/i })).toBeInTheDocument();
        } else {
            expect(screen.queryByRole("button", { name: /Notifications/i })).not.toBeInTheDocument();
        }
        expect(screen.getByRole("button", { name: /Appearance/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Workflows/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /About/i })).toBeInTheDocument();

        expect(screen.queryByRole("button", { name: /Practice/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Security/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /License/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Integrationen/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Migration/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^System$/i })).not.toBeInTheDocument();
    });
});
