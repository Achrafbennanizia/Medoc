/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import App from "@/App";
import { setDeploymentModeCache } from "@/systems/practice-host/adapters/practice-transport";
import { tauriInvoke } from "@/services/tauri.service";
import { CLUSTER_STATUS_READY } from "@/models/store/cluster-store";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Aya M.",
    email: "aya@practice.de",
    role: "RECEPTION",
};

const SYNC_STATUS = {
    localDeviceId: "smoke-rez",
    deployment: {
        schemaVersion: 1,
        mode: "practice_desktop",
        role: "MASTER",
        masterBaseUrl: "",
        masterCertSha256: "",
        masterAccessToken: "",
        deviceLabel: "Smoke Rez",
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

function resetAuthStore() {
    useAuthStore.setState({ session: null, sessionChecked: false });
}

function mockAuthedReceptionIpc(sessionHold: { current: Session | null }) {
    vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
        switch (cmd) {
            case "get_db_setup_status":
                return { needsPassphraseSetup: false, needsUnlock: false };
            case "get_session":
                return sessionHold.current;
            case "login":
                sessionHold.current = REZ_SESSION;
                return REZ_SESSION;
            case "logout":
                sessionHold.current = null;
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
                return SYNC_STATUS;
            case "current_license_status":
                return { valid: true, format: "v2" };
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
            case "list_patients":
            case "list_purchase_orders":
                return [];
            case "count_open_practice_tasks_for_me":
                return 0;
            case "count_unread_in_app_notifications":
                return 0;
            case "list_practice_tasks_for_me":
            case "list_practice_tickets_for_me":
                return [];
            case "list_task_team_directory":
                return [];
            case "work_time_reconcile_on_login":
                return { closedStaleCount: 0 };
            case "work_time_get_preference":
                return { focusMode: false, autoRecordOnLogin: false, autoRecordOnLogout: false };
            case "work_time_get_active_session":
                return null;
            case "work_time_get_week_overview":
                return { weekStart: "2026-01-05", sessions: [], totalMinutes: 0, days: [] };
            default:
                throw new Error(`unmocked IPC in G21 routing smoke: ${cmd}`);
        }
    });
}

afterEach(() => {
    cleanup();
    resetAuthStore();
    vi.clearAllMocks();
});

describe("G21 routing smoke (row 1 proxy)", () => {
    const sessionHold = { current: null as Session | null };

    beforeEach(() => {
        sessionHold.current = null;
        resetAuthStore();
        setDeploymentModeCache("practice_desktop");
        mockAuthedReceptionIpc(sessionHold);
    });

    it("RECEPTION can open Practice-Tickets (integrated practice tasks) without access denied", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("Email"), REZ_SESSION.email);
        const pw = document.querySelector<HTMLInputElement>("#password");
        expect(pw).toBeTruthy();
        await user.type(pw!, "secret123");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        expect(await screen.findByRole("heading", { name: "Work time" })).toBeInTheDocument();

        const aside = screen.getByRole("complementary");
        await user.click(within(aside).getByRole("link", { name: /Practice tasks/i }));

        expect(await screen.findByRole("heading", { name: /Practice tasks/i })).toBeInTheDocument();
        expect(await screen.findByText(/No open tasks/i)).toBeInTheDocument();

        await waitFor(() => {
            const cmds = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
            expect(cmds).toContain("list_practice_tasks_for_me");
        });
    });
});
