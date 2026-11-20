import type {
    PracticeTask,
    PracticeTaskStatus,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { taskWorkflowTrack } from "@/systems/practice-host/controllers/practice-task.controller";
import type { Staff } from "@/models/types";
import { allowed, type PermissionOverride, type Role } from "@/lib/rbac";

export function taskStatusVariant(status: PracticeTaskStatus): "default" | "primary" | "warning" | "success" {
    switch (status) {
        case "OPEN":
        case "BACK":
            return "warning";
        case "IN_PROGRESS":
        case "VIEWED":
            return "primary";
        case "DONE_RECEPTION":
            return "default";
        case "VALIDATED":
        case "DONE":
            return "success";
        default:
            return "default";
    }
}

const VERIFY_FULFILL_STATUSES = ["OPEN", "IN_PROGRESS", "BACK"] as const;
const SIMPLE_FULFILL_STATUSES = ["OPEN", "VIEWED"] as const;

function fulfillStatusesFor(task: PracticeTask): readonly string[] {
    return taskWorkflowTrack(task.kind) === "simple"
        ? SIMPLE_FULFILL_STATUSES
        : VERIFY_FULFILL_STATUSES;
}

export function assigneeLabel(
    row: PracticeTask,
    staff: Staff[],
    t: (key: string) => string,
): string {
    if (row.assignee_role === "RECEPTION") return t("practice.tasks.form.assignee_pool");
    if (row.assignee_user_id) {
        const p = staff.find((x) => x.id === row.assignee_user_id);
        if (p) {
            const roleKey = `enum.role.${p.role.toLowerCase()}`;
            const roleLabel = t(roleKey);
            const role = roleLabel === roleKey ? p.role : roleLabel;
            return `${p.name} (${role})`;
        }
        return row.assignee_user_id;
    }
    return t("common.dash");
}

function isPoolTask(a: PracticeTask): boolean {
    return (
        a.assignee_role === "RECEPTION" &&
        (!a.assignee_user_id || a.assignee_user_id.trim() === "")
    );
}

export function canFulfillAsReception(a: PracticeTask, userId: string): boolean {
    if (!fulfillStatusesFor(a).includes(a.status)) return false;
    if (a.assignee_user_id && a.assignee_user_id.trim() !== "") {
        return a.assignee_user_id === userId;
    }
    return isPoolTask(a);
}

export function canFulfillAsPhysician(a: PracticeTask, userId: string): boolean {
    return a.assignee_user_id === userId && fulfillStatusesFor(a).includes(a.status);
}

export function canValidateAsPhysician(a: PracticeTask, userId: string): boolean {
    if (taskWorkflowTrack(a.kind) === "simple") return false;
    return a.created_by === userId && a.status === "DONE_RECEPTION";
}

export function canValidateAsReception(a: PracticeTask, userId: string): boolean {
    if (taskWorkflowTrack(a.kind) === "simple") return false;
    return a.created_by === userId && a.status === "DONE_RECEPTION";
}

/** Mirrors `task_visibility::user_can_view_task` (+ admin override). */
export function userCanViewTask(
    a: PracticeTask,
    userId: string,
    opts: { isReception: boolean; canAdmin?: boolean },
): boolean {
    if (opts.canAdmin) return true;
    const uid = userId.trim();
    if (a.created_by.trim() === uid && a.status !== "VALIDATED" && a.status !== "DONE") return true;
    const assignee = a.assignee_user_id?.trim();
    if (assignee && assignee === uid) return true;
    return opts.isReception && isPoolTask(a);
}

export function dispatchNavBadgeRefresh(openTasks: number) {
    window.dispatchEvent(
        new CustomEvent("medoc-nav-badges-refresh", { detail: { openTasks } }),
    );
}

/** RBAC: `task.status.fulfill` — In Processing / Done setzen. */
export function canFulfillTaskStatus(
    role: Role | null,
    overrides?: readonly PermissionOverride[],
): boolean {
    return role != null && allowed("task.status.fulfill", role, overrides);
}

/** RBAC: `task.status.admin` — beliebiger Statuswechsel. */
export function canAdminTaskStatus(
    role: Role | null,
    overrides?: readonly PermissionOverride[],
): boolean {
    return role != null && allowed("task.status.admin", role, overrides);
}
