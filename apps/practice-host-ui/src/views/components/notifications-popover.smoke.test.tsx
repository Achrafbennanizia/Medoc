/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { InAppNotification } from "@/models/types";
import { listInAppNotifications } from "@/systems/practice-host/controllers/in-app-notification.controller";
import { NotificationsPopover } from "./notifications-popover";

vi.mock("@/systems/practice-host/controllers/in-app-notification.controller", () => ({
    listInAppNotifications: vi.fn(),
    countUnreadInAppNotifications: vi.fn(),
    markInAppNotificationRead: vi.fn(),
    markAllInAppNotificationsRead: vi.fn(),
}));

const AUFGABE_ERLEDIGT: InAppNotification = {
    id: "notif-aufg-1",
    user_id: "seed-arzt-001",
    kind: "PRAXIS_AUFGABE_ERLEDIGT",
    title: "Aufgabe erledigt: Max Mustermann",
    body: "Ausdruck liegt bereit",
    payload_json: JSON.stringify({
        aufgabeId: "aufg-1",
        patientId: "pat-1",
        typ: "SONSTIGES",
    }),
    read_at: null,
    created_at: "2026-05-31T12:00:00Z",
};

const AUFGABE_ZURUECK: InAppNotification = {
    id: "notif-aufg-2",
    user_id: "seed-rez-001",
    kind: "PRAXIS_AUFGABE_ZURUECK",
    title: "Aufgabe zurück: Max Mustermann",
    body: "Bitte korrigieren",
    payload_json: JSON.stringify({
        aufgabeId: "aufg-2",
        patientId: "pat-1",
        typ: "SONSTIGES",
        status: "ZURUECK",
    }),
    read_at: null,
    created_at: "2026-06-10T12:00:00Z",
};

describe("NotificationsPopover smoke (G21 row 4 proxy)", () => {
    it("shows PRAXIS_AUFGABE_ZURUECK notification for Rezeption", async () => {
        vi.mocked(listInAppNotifications).mockResolvedValue([AUFGABE_ZURUECK]);

        render(
            <MemoryRouter>
                <NotificationsPopover onClose={() => {}} />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Aufgabe zurück: Max Mustermann")).toBeInTheDocument();
        expect(screen.getByText("Bitte korrigieren")).toBeInTheDocument();
    });

    it("shows PRAXIS_AUFGABE_ERLEDIGT notification for Arzt", async () => {
        vi.mocked(listInAppNotifications).mockResolvedValue([AUFGABE_ERLEDIGT]);

        render(
            <MemoryRouter>
                <NotificationsPopover onClose={() => {}} />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Aufgabe erledigt: Max Mustermann")).toBeInTheDocument();
        expect(screen.getByText("Ausdruck liegt bereit")).toBeInTheDocument();
    });
});
