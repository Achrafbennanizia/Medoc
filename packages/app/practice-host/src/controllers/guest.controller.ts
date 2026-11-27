/**
 * Solo guest account and inbox (docs/architecture/editions-plan.md §4.2).
 *
 * The guest proposes; the admin adds or dismisses. Controllers call {@link invokeOrPropose} for
 * the writes a guest may propose: the admin's call runs at once, the guest's becomes a proposal and
 * the caller gets a placeholder without id ({@link isProposal}). The backend refuses guest writes
 * anyway; this only routes them to the inbox.
 */
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { useAuthStore } from "@/models/store/auth-store";

export type GuestAccount = {
    exists: boolean;
    enabled: boolean;
    staffId: string | null;
    email: string;
    clinicalRead: boolean;
};

export type StagedChangeStatus = "PENDING" | "ADDED" | "DISMISSED";

export type StagedChange = {
    id: string;
    command: ProposableCommand;
    argsJson: string;
    summaryJson: string;
    createdBy: string;
    createdAt: string;
    status: StagedChangeStatus;
    decidedBy: string | null;
    decidedAt: string | null;
    reason: string | null;
    resultId: string | null;
};

export type ProposableCommand =
    | "create_appointment"
    | "update_appointment"
    | "move_appointments"
    | "create_patient"
    | "update_patient"
    | "create_payment";

/** Window event after a proposal was sent (the shell shows a notice and refreshes the badge). */
export const PROPOSAL_SENT_EVENT = "medoc-proposal-sent";
/** Window event after the admin added or dismissed proposals. */
export const PROPOSALS_CHANGED_EVENT = "medoc-proposals-changed";

/** In guest-inbox editions (Solo) the only reception login is the guest. */
export function isGuestSession(): boolean {
    return __CAP_GUEST_INBOX__ && useAuthStore.getState().session?.role === "RECEPTION";
}

/** A placeholder returned for a proposal: it has no id until the admin adds it. */
export function isProposal(row: { id?: string | null }): boolean {
    return __CAP_GUEST_INBOX__ && !row.id;
}

/** Runs `command`, or, for the guest, sends it to the admin's inbox and returns `placeholder`. */
export async function invokeOrPropose<T>(
    command: ProposableCommand,
    args: Record<string, unknown>,
    placeholder: () => T,
): Promise<T> {
    if (!isGuestSession()) return practiceSystem.invoke<T>(command, args);
    await practiceSystem.invoke<StagedChange>("staged_change_submit", { command, args, summary: {} });
    window.dispatchEvent(new Event(PROPOSAL_SENT_EVENT));
    return placeholder();
}

export const getGuestAccount = () => practiceSystem.invoke<GuestAccount>("guest_account_get");

export const setGuestAccount = (request: { enabled: boolean; password?: string; clinicalRead: boolean }) =>
    practiceSystem.invoke<GuestAccount>("guest_account_set", { request });

export const listStagedChanges = (status?: StagedChangeStatus) =>
    practiceSystem.invoke<StagedChange[]>("staged_change_list", { status: status ?? null });

export const countPendingStagedChanges = () => practiceSystem.invoke<number>("staged_change_count_pending");

export async function addStagedChange(id: string): Promise<StagedChange> {
    const row = await practiceSystem.invoke<StagedChange>("staged_change_add", { id });
    window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT));
    return row;
}

export async function dismissStagedChange(id: string, reason?: string): Promise<StagedChange> {
    const row = await practiceSystem.invoke<StagedChange>("staged_change_dismiss", { id, reason: reason ?? null });
    window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT));
    return row;
}
