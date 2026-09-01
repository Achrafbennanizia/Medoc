/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { INBOX_POLL_MS, INBOX_UI_ENABLED } from "@/lib/inbox-config";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import {
    countOpenPracticeTasksForMe,
    listPracticeTasksForMe,
    transitionPracticeTask,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { InboxPage } from "./inbox";

vi.mock("@/systems/practice-host/controllers/practice-task.controller", () => ({
    listPracticeTasksForMe: vi.fn(),
    countOpenPracticeTasksForMe: vi.fn(),
    transitionPracticeTask: vi.fn(),
}));

const REZ_SESSION: Session = {
    user_id: "u-rez-g21",
    name: "Reception G21",
    email: "aya@practice.de",
    role: "RECEPTION",
};

const SAMPLE_TASK: PracticeTask = {
    id: "aufg-1",
    patient_id: "pat-1",
    kind: "OTHER",
    title: "Test Task",
    body: "Please complete",
    assignee_role: "RECEPTION",
    assignee_user_id: null,
    created_by: "seed-physician-001",
    treatment_id: null,
    examination_id: null,
    service_name: null,
    total_cost: null,
    payment_id: null,
    done_note: null,
    return_reason: null,
    status: "IN_PROGRESS",
    legacy_ticket_id: null,
    created_at: "2026-05-31T10:00:00Z",
    updated_at: "2026-05-31T10:00:00Z",
};

function resetAuth() {
    useAuthStore.setState({ session: null, sessionChecked: true });
}

describe.skipIf(!INBOX_UI_ENABLED)("Inbox smoke (G21)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetAuth();
        useAuthStore.setState({ session: REZ_SESSION, sessionChecked: true });
        vi.mocked(listPracticeTasksForMe).mockResolvedValue([]);
        vi.mocked(countOpenPracticeTasksForMe).mockResolvedValue(0);
    });

    afterEach(() => {
        vi.useRealTimers();
        resetAuth();
        vi.clearAllMocks();
    });

    it("loads tasks and polls on FA-AUFG-03 interval", async () => {
        render(
            <MemoryRouter>
                <InboxPage />
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(listPracticeTasksForMe).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/No open tasks/i)).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(INBOX_POLL_MS);
        });
        expect(listPracticeTasksForMe).toHaveBeenCalledTimes(2);
    });

    it("REZ can mark in-progress task as done (checklist row 4 proxy)", async () => {
        vi.useRealTimers();
        vi.mocked(listPracticeTasksForMe).mockResolvedValue([SAMPLE_TASK]);
        vi.mocked(transitionPracticeTask).mockResolvedValue(undefined);

        render(
            <MemoryRouter>
                <InboxPage />
            </MemoryRouter>,
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.getByText("Test Task")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Completion note/i), {
            target: { value: "Kasse erfasst" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Complete/i }));
        await act(async () => {
            await Promise.resolve();
        });
        expect(transitionPracticeTask).toHaveBeenCalledWith({
            id: "aufg-1",
            status: "DONE_RECEPTION",
            doneNote: "Kasse erfasst",
        });
    });
});
