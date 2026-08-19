import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOTIFICATIONS_SETTINGS_ENABLED } from "@/lib/settings-ui-flags";
import { useAuthStore } from "@/models/store/auth-store";
import { SettingsPage } from "./settings";

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

vi.mock("@/lib/practice-preferences-storage", () => ({
    DEFAULT_PRACTICE_PREFERENCES: { bufferMin: "0", emergencyBuffer: "0", reminder: "0", noShow: "warn", calendarDragDropEnabled: false },
    hydratePracticePreferencesFromKv: vi.fn().mockResolvedValue({ bufferMin: "0", emergencyBuffer: "0", reminder: "0", noShow: "warn", calendarDragDropEnabled: false }),
    savePracticePreferences: vi.fn(),
}));

vi.mock("@/systems/practice-host/pages/settings/settings-account-section", () => ({
    SettingsAccountSection: () => <div data-testid="account-panel">Account</div>,
}));

describe("SettingsPage RBAC nav", () => {
    beforeEach(() => {
        useAuthStore.setState({
            session: {
                user_id: "u-reception",
                name: "Reception Test",
                email: "rez@test.de",
                role: "RECEPTION",
                permission_overrides: [],
            },
        });
    });

    it("shows only frontdesk settings sections for RECEPTION", () => {
        render(
            <MemoryRouter initialEntries={["/settings"]}>
                <SettingsPage />
            </MemoryRouter>,
        );

        expect(screen.getByRole("button", { name: /Account/i })).toBeInTheDocument();
        if (NOTIFICATIONS_SETTINGS_ENABLED) {
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
