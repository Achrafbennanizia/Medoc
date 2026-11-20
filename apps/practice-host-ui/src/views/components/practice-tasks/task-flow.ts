/**
 * Practice-task flow (single source for ordering, inbox membership and allowed next steps).
 *
 *   BACK ─┐
 *         ▼
 *   OPEN → IN_PROGRESS → DONE_RECEPTION ──(creator)──▶ VALIDATED
 *            ▲   │              │
 *            └───┘ (reopen)     └──(creator returns)──▶ BACK
 *
 * Order in every list = status phase (registry) → newest activity first. A task that changes status is
 * re-ranked immediately (it no longer keeps its old slot until the next poll), and tasks that left the
 * user's inbox (e.g. just VALIDATED) disappear at once.
 */
import type { PracticeTask, PracticeTaskStatus } from "@/systems/practice-host/controllers/practice-task.controller";
import { parseInstant } from "@/lib/practice-clock";
import { canTransition, nextStatuses, statusIsOpen, statusRank } from "@/lib/status/status-registry";

function activityMs(task: PracticeTask): number {
    return parseInstant(task.updated_at)?.getTime() ?? parseInstant(task.created_at)?.getTime() ?? 0;
}

/** Stable comparator: phase rank, then most recent activity, then id. */
export function compareTasksByFlow(a: PracticeTask, b: PracticeTask): number {
    const rank = statusRank("practice_task", a.status) - statusRank("practice_task", b.status);
    if (rank !== 0) return rank;
    const recent = activityMs(b) - activityMs(a);
    if (recent !== 0) return recent;
    return a.id.localeCompare(b.id);
}

export function sortTasksByFlow(tasks: readonly PracticeTask[]): PracticeTask[] {
    return [...tasks].sort(compareTasksByFlow);
}

/** Still belongs in a personal inbox ("for me"): anything not yet validated. */
export function taskBelongsInInbox(task: PracticeTask): boolean {
    return statusIsOpen("practice_task", task.status);
}

/** Merge an updated task into a list, re-rank, and optionally drop tasks that left the view. */
export function mergeUpdatedTask(
    list: readonly PracticeTask[],
    updated: PracticeTask,
    keep: (t: PracticeTask) => boolean = () => true,
): PracticeTask[] {
    const replaced = list.some((t) => t.id === updated.id)
        ? list.map((t) => (t.id === updated.id ? updated : t))
        : [...list, updated];
    return sortTasksByFlow(replaced.filter(keep));
}

export function taskCanMove(from: PracticeTaskStatus, to: PracticeTaskStatus): boolean {
    return canTransition("practice_task", from, to);
}

export function taskNextStatuses(current: PracticeTaskStatus): PracticeTaskStatus[] {
    return nextStatuses("practice_task", current) as PracticeTaskStatus[];
}
