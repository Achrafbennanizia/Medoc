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

const TASK_DONE: InAppNotification = {
    id: "notif-aufg-1",
    user_id: "seed-physician-001",
    kind: "PRACTICE_TASK_DONE",
    title: "Task done: Max Mustermann",
    body: "Ausdruck liegt bereit",
    payload_json: JSON.stringify({
        taskId: "aufg-1",
        patientId: "pat-1",
        kind: "OTHER",
    }),
    read_at: null,
    created_at: "2026-05-31T12:00:00Z",
};

const TASK_BACK: InAppNotification = {
    id: "notif-aufg-2",
    user_id: "seed-rez-001",
    kind: "PRACTICE_TASK_BACK",
    title: "Task zurück: Max Mustermann",
    body: "Bitte korrigieren",
    payload_json: JSON.stringify({
        taskId: "aufg-2",
        patientId: "pat-1",
        kind: "OTHER",
        status: "BACK",
    }),
    read_at: null,
    created_at: "2026-06-10T12:00:00Z",
};

describe("NotificationsPopover smoke (G21 row 4 proxy)", () => {
    it("shows PRACTICE_TASK_BACK notification for Reception", async () => {
        vi.mocked(listInAppNotifications).mockResolvedValue([TASK_BACK]);

        render(
            <MemoryRouter>
                <NotificationsPopover onClose={() => {}} />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Task zurück: Max Mustermann")).toBeInTheDocument();
        expect(screen.getByText("Bitte korrigieren")).toBeInTheDocument();
    });

    it("shows PRACTICE_TASK_DONE notification for Physician", async () => {
        vi.mocked(listInAppNotifications).mockResolvedValue([TASK_DONE]);

        render(
            <MemoryRouter>
                <NotificationsPopover onClose={() => {}} />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Task done: Max Mustermann")).toBeInTheDocument();
        expect(screen.getByText("Ausdruck liegt bereit")).toBeInTheDocument();
    });
});
