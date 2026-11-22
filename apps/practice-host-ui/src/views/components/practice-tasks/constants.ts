import type { PracticeTaskStatus, PracticeTaskKind } from "@/systems/practice-host/controllers/practice-task.controller";
import { taskNextStatuses } from "./task-flow";

export const PRACTICE_TASK_KINDS: readonly { value: PracticeTaskKind; labelKey: string }[] = [
    { value: "BILLING", labelKey: "practice.tasks.kind.billing" },
    { value: "APPOINTMENT", labelKey: "practice.tasks.kind.appointment" },
    { value: "PRINT", labelKey: "practice.tasks.kind.print" },
    { value: "MASTER_DATA", labelKey: "practice.tasks.kind.master_data" },
    { value: "OTHER", labelKey: "practice.tasks.kind.other" },
    { value: "TICKET", labelKey: "practice.tasks.kind.ticket" },
];

export const PRACTICE_TASK_STATUSES: readonly { value: PracticeTaskStatus; labelKey: string }[] = [
    { value: "BACK", labelKey: "practice.tasks.status.back" },
    { value: "OPEN", labelKey: "practice.tasks.status.open" },
    { value: "IN_PROGRESS", labelKey: "practice.tasks.status.in_processing" },
    { value: "DONE_RECEPTION", labelKey: "practice.tasks.status.done_reception" },
    { value: "VALIDATED", labelKey: "practice.tasks.status.validated" },
    { value: "VIEWED", labelKey: "practice.tasks.status.viewed" },
    { value: "DONE", labelKey: "practice.tasks.status.done" },
];

/**
 * Status dropdown per RBAC (`task.status.fulfill` / `task.status.admin`).
 * Fulfillers only get transitions the backend allows from the *current* status (registry), so the UI never
 * offers e.g. OPEN → Done (rejected by `workflow_transitions.rs`).
 */
export function selectableTaskStatuses(opts: {
    current: PracticeTaskStatus;
    canAdminStatus: boolean;
    canFulfillStatus: boolean;
    track?: "simple" | "verify";
}): readonly { value: PracticeTaskStatus; labelKey: string }[] {
    if (opts.canAdminStatus) {
        if (opts.current === "VALIDATED" || opts.current === "DONE") {
            return PRACTICE_TASK_STATUSES.filter((s) => s.value === opts.current);
        }
        return PRACTICE_TASK_STATUSES;
    }
    const allowedValues = new Set<PracticeTaskStatus>([opts.current]);
    if (opts.canFulfillStatus) {
        // Only transitions the backend allows from the current status on this task's track.
        for (const next of taskNextStatuses(opts.current, opts.track ?? "verify")) {
            if (next !== "VALIDATED" && next !== "BACK") allowedValues.add(next);
        }
    }
    return PRACTICE_TASK_STATUSES.filter((s) => allowedValues.has(s.value));
}

export const TASK_NO_PATIENT_VALUE = "";
export function taskPatientLabel(
    patientId: string | null | undefined,
    patientMap: Map<string, { name: string }>,
    emptyLabel = "—",
): string {
    const id = patientId?.trim();
    if (!id) return emptyLabel;
    return patientMap.get(id)?.name ?? emptyLabel;
}

export type AssigneeMode = "reception" | "user";

export type PracticeTaskTaskForm = {
    patientId: string;
    kind: PracticeTaskKind;
    title: string;
    body: string;
    assigneeMode: AssigneeMode;
    assigneeUserId: string;
    status: PracticeTaskStatus;
};

export function emptyPracticeTaskForm(): PracticeTaskTaskForm {
    return {
        patientId: TASK_NO_PATIENT_VALUE,
        kind: "OTHER",
        title: "",
        body: "",
        assigneeMode: "reception",
        assigneeUserId: "",
        status: "OPEN",
    };
}
