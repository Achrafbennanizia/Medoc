import type { PracticeTaskStatus } from "@/systems/practice-host/controllers/practice-task.controller";
import { PRACTICE_TASK_STATUSES, PRACTICE_TASK_KINDS } from "./constants";

export function taskDrawerText(t: (key: string) => string, key: string): string {
    return t(key);
}

export const TASK_WORKFLOW_STEPS = [
    { labelKey: "practice.tasks.workflow.open", status: "OPEN" as const },
    { labelKey: "practice.tasks.workflow.in_processing", status: "IN_PROGRESS" as const },
    { labelKey: "practice.tasks.workflow.done", status: "DONE_RECEPTION" as const },
    { labelKey: "practice.tasks.workflow.validated", status: "VALIDATED" as const },
] as const;

export function taskWorkflowStepLabel(
    t: (key: string) => string,
    step: { labelKey: string },
): string {
    return t(step.labelKey);
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