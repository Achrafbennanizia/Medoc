import type { PracticeTaskStatus } from "@/systems/practice-host/controllers/practice-task.controller";
import { PRACTICE_TASK_STATUSES, PRACTICE_TASK_KINDS } from "./constants";

/** Drawer copy fallbacks — used when i18n key is missing (e.g. stale dev bundle). */
export const TASK_DRAWER_FALLBACKS: Record<string, string> = {
    "page.practice_tickets.drawer_eyebrow": "Task",
    "page.practice_tickets.drawer_created": "Created",
    "page.practice_tickets.drawer_updated": "Updated",
    "page.practice_tickets.drawer_assignee": "Assigned",
    "page.practice_tickets.drawer_workflow": "Workflow",
    "page.practice_tickets.drawer_patient": "Patient",
    "page.practice_tickets.drawer_creator": "Created by",
    "page.practice_tickets.drawer_edit": "Edit",
    "page.practice_tickets.comments_title": "Communication",
    "page.practice_tickets.comments_loading": "Loading comments…",
    "page.practice_tickets.comments_empty": "No messages yet — start the conversation.",
    "page.practice_tickets.comment_label": "Message",
    "page.practice_tickets.comment_placeholder": "Question or note for the team…",
    "page.practice_tickets.comment_send": "Send",
};

export function taskDrawerText(t: (key: string) => string, key: string): string {
    const version = t(key);
    return version === key ? (TASK_DRAWER_FALLBACKS[key] ?? version) : version;
}

export const TASK_WORKFLOW_STEPS = [
    { labelKey: "practice.tasks.workflow.open", label: "Open", status: "OPEN" as const },
    { labelKey: "practice.tasks.workflow.in_processing", label: "In progress", status: "IN_PROGRESS" as const },
    { labelKey: "practice.tasks.workflow.done", label: "Done", status: "DONE_RECEPTION" as const },
    { labelKey: "practice.tasks.workflow.validated", label: "Validated", status: "VALIDATED" as const },
] as const;

/** Resolve a workflow-step caption via i18n, with English fallback. */
export function taskWorkflowStepLabel(
    t: (key: string) => string,
    step: { labelKey: string; label: string },
): string {
    const version = t(step.labelKey);
    return version === step.labelKey ? step.label : version;
}

export function taskWorkflowActiveStep(status: PracticeTaskStatus): number {
    switch (status) {
        case "OPEN":
        case "BACK":
            return 0;
        case "IN_PROGRESS":
            return 1;
        case "DONE_RECEPTION":
            return 2;
        case "VALIDATED":
            return 3;
        default:
            return 0;
    }
}

export function taskStatusLabel(t: (key: string) => string, status: PracticeTaskStatus): string {
    const key = `practice.tasks.status.${status.toLowerCase()}`;
    const version = t(key);
    if (version !== key) return version;
    const fallbackKey = PRACTICE_TASK_STATUSES.find((s) => s.value === status)?.labelKey;
    return fallbackKey ? t(fallbackKey) : status;
}

export function taskStatusPillClass(status: PracticeTaskStatus): string {
    switch (status) {
        case "OPEN":
        case "BACK":
            return "yellow";
        case "IN_PROGRESS":
            return "blue";
        case "DONE_RECEPTION":
            return "grey";
        case "VALIDATED":
            return "green";
        default:
            return "grey";
    }
}

export function taskKindLabel(t: (key: string) => string, kind: string): string {
    const key = `practice.tasks.kind.${kind.toLowerCase()}`;
    const version = t(key);
    if (version !== key) return version;
    const fallbackKey = PRACTICE_TASK_KINDS.find((row) => row.value === kind)?.labelKey;
    return fallbackKey ? t(fallbackKey) : kind;
}