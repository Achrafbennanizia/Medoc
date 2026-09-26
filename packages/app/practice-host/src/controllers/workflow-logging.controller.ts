import {
    logWorkflowRouteEnter,
    logWorkflowStep,
    type WorkflowStepPayload,
} from "../adapters/practice-transport";

export type { WorkflowPhase, WorkflowStepPayload } from "../adapters/practice-transport";

/** Dedicated frontend→backend workflow telemetry bridge (best-effort). */
export async function logUiWorkflowRouteEnter(route: string): Promise<void> {
    await logWorkflowRouteEnter(route);
}

export async function logUiWorkflowStep(payload: WorkflowStepPayload): Promise<void> {
    await logWorkflowStep(payload);
}

export async function logUiWorkflowCancel(
    workflow: string,
    step: string,
    route?: string,
    message?: string,
): Promise<void> {
    await logWorkflowStep({
        workflow,
        step,
        phase: "cancel",
        route,
        message,
    });
}
