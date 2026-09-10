/** @vitest-environment jsdom */
/** Auth flows that mount full `<App />` — kept in their own file to bound CI heap. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import App from "@/App";
import { tauriInvoke } from "@/services/tauri.service";
import { CLUSTER_STATUS_READY } from "@/models/store/cluster-store";
import {
    PHYSICIAN_SESSION,
    installCriticalFlowCleanup,
    resetAuthStore,
} from "./critical-flows.smoke.shared";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

afterEach(installCriticalFlowCleanup());

/**
 * Full `<App />` pulls the entire route graph; Vitest collect alone exceeds ~6GB
 * and OOMs on 7GB GitHub-hosted runners. Run locally without CI=1 when needed.
 */
const describeApp = describe.skipIf(!!process.env.CI);

describeApp("critical flow (a) login → dashboard → logout", () => {
    let sessionHold: Session | null = null;

    beforeEach(() => {
        sessionHold = null;
        resetAuthStore();
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            switch (cmd) {
                case "get_db_setup_status":
                    return { needsPassphraseSetup: false, needsUnlock: false };
                case "get_session":
                    return sessionHold;
                case "login":
                    sessionHold = PHYSICIAN_SESSION;
                    return PHYSICIAN_SESSION;
                case "logout":
                    sessionHold = null;
                    return undefined;
                case "touch_session":
                    return true;
                case "check_for_updates":
                    return {
                        current_version: "0.1.0",
                        latest_version: "0.1.0",
                        update_available: false,
                        channel: "stable",
                    };
                case "get_app_kv":
                    return null;
                case "sync_native_menu":
                    return undefined;
                case "sync_get_status":
                    return {
                        localDeviceId: "smoke-master",
                        deployment: {
                            schemaVersion: 1,
                            mode: "practice_desktop",
                            role: "MASTER",
                            masterBaseUrl: "",
                            masterCertSha256: "",
                            masterAccessToken: "",
                            deviceLabel: "Smoke Master",
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
                    };
                case "current_license_status":
                    return { valid: true, format: "v1" };
                case "cluster_status_cmd":
                    return CLUSTER_STATUS_READY;
                case "get_dashboard_stats":
                    return {
                        patients_total: 0,
                        appointments_today: 0,
                        revenue_month: 0,
                        products_low: 0,
                    };
                case "list_appointments":
                    return [];
                case "list_patients":
                    return [];
                case "list_purchase_orders":
                    return [];
                default:
                    throw new Error(`unmocked IPC in flow (a): ${cmd}`);
            }
        });
    });

    it("signs in, shows dashboard greeting, signs out", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("Email"), "smoke@medoc.test");
        const pw = document.querySelector<HTMLInputElement>("#password");
        expect(pw).toBeTruthy();
        await user.type(pw!, "secret123");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        expect(await screen.findByRole("heading", { name: /Good morning, Dr\. Smoke/ })).toBeInTheDocument();

        const aside = screen.getByRole("complementary");
        await user.click(within(aside).getByRole("button", { name: "Account: settings and sign out" }));
        await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

        const logoutDialog = await screen.findByRole("dialog", { name: "Sign out?" });
        await user.click(within(logoutDialog).getByRole("button", { name: "Sign out" }));

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        });
        const ipcCommands = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
        expect(ipcCommands, `IPC calls: ${ipcCommands.join(", ")}`).toContain("logout");
    });
});

describeApp("critical flow (f) login rejection on wrong password", () => {
    beforeEach(() => {
        resetAuthStore();
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            switch (cmd) {
                case "get_db_setup_status":
                    return { needsPassphraseSetup: false, needsUnlock: false };
                case "get_session":
                    return null;
                case "login":
                    throw new Error("error.app.unauthorized");
                case "check_for_updates":
                    return {
                        current_version: "0.1.0",
                        latest_version: "0.1.0",
                        update_available: false,
                        channel: "stable",
                    };
                case "sync_native_menu":
                    return undefined;
                case "get_app_kv":
                    return null;
                case "cluster_status_cmd":
                    return CLUSTER_STATUS_READY;
                default:
                    throw new Error(`unmocked IPC in flow (f): ${cmd}`);
            }
        });
    });

    it("surfaces the backend error message and keeps the user on the login screen", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("Email"), "smoke@medoc.test");
        const pw = document.querySelector<HTMLInputElement>("#password");
        expect(pw).toBeTruthy();
        await user.type(pw!, "bogus");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        const alert = await screen.findByRole("alert");
        expect(alert.textContent ?? "").toMatch(/error\.app\.unauthorized|Not authorized/i);

        expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        const ipcCommands = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
        expect(ipcCommands).toContain("login");
        expect(useAuthStore.getState().session).toBeNull();
    });
});
