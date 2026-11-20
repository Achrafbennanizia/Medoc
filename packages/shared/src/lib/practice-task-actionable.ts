/** Verify-track open statuses for reception. */
export const RECEPTION_VERIFY_ACTIONABLE_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BACK"] as const;

/** Simple-track open statuses for reception. */
export const RECEPTION_SIMPLE_ACTIONABLE_TASK_STATUSES = ["OPEN", "VIEWED"] as const;

/** Union used by dashboard pending list (both tracks). */
export const RECEPTION_ACTIONABLE_TASK_STATUSES = [
    "OPEN",
    "IN_PROGRESS",
    "BACK",
    "VIEWED",
] as const;

export type ReceptionActionableTaskStatus = (typeof RECEPTION_ACTIONABLE_TASK_STATUSES)[number];

export function isReceptionActionableTaskStatus(status: string): status is ReceptionActionableTaskStatus {
    return (RECEPTION_ACTIONABLE_TASK_STATUSES as readonly string[]).includes(status);
}

/** Filter practice tasks that belong on the reception “Pending tasks” dashboard card. */
export function filterReceptionPendingTasks<T extends { status: string }>(tasks: T[]): T[] {
    return tasks.filter((task) => isReceptionActionableTaskStatus(task.status));
}
