import type { PracticeTaskStatus } from "@/systems/practice-host/controllers/practice-task.controller";
import { statusDefinition, statusDescriptionKey, statusLabelKey, statusPillClass } from "@/lib/status/status-registry";
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
    const key = statusLabelKey("practice_task", status);
    const label = t(key);
    if (label !== key) return label;
    const fallbackKey = PRACTICE_TASK_STATUSES.find((s) => s.value === status)?.labelKey;
    return fallbackKey ? t(fallbackKey) : status;
}

/** One-sentence meaning of the status (tooltip). */
export function taskStatusDescription(t: (key: string) => string, status: PracticeTaskStatus): string {
    return t(statusDescriptionKey("practice_task", status));
}

export function taskStatusPillClass(status: PracticeTaskStatus): string {
    const def = statusDefinition("practice_task", status);
    return def ? statusPillClass(def.tone) : "grey";
}

export function taskKindLabel(t: (key: string) => string, kind: string): string {
    const key = `practice.tasks.kind.${kind.toLowerCase()}`;
    const version = t(key);
    if (version !== key) return version;
    const fallbackKey = PRACTICE_TASK_KINDS.find((row) => row.value === kind)?.labelKey;
    return fallbackKey ? t(fallbackKey) : kind;
}