export type WorkflowStepStatus =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export type WorkflowStepEvent = {
    workflow: string;
    step: string;
    status: WorkflowStepStatus | string;
    route?: string;
    action?: string;
    detail?: string;
    source?: "frontend" | "backend" | string;
    timestamp?: string;
};

export const WORKFLOW_LOG_EVENT_NAME = "medoc-workflow-step";

function enrich(event: WorkflowStepEvent): WorkflowStepEvent {
    return {
        ...event,
        source: event.source ?? "frontend",
        timestamp: event.timestamp ?? new Date().toISOString(),
    };
}

export function publishWorkflowStep(event: WorkflowStepEvent): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent<WorkflowStepEvent>(WORKFLOW_LOG_EVENT_NAME, {
            detail: enrich(event),
        }),
    );
}

export function subscribeWorkflowSteps(
    listener: (event: WorkflowStepEvent) => void,
): () => void {
    if (typeof window === "undefined") return () => {};
    const onEvent = (ev: WindowEventMap[typeof WORKFLOW_LOG_EVENT_NAME]) =>
        listener(ev.detail);
    window.addEventListener(WORKFLOW_LOG_EVENT_NAME, onEvent);
    return () => window.removeEventListener(WORKFLOW_LOG_EVENT_NAME, onEvent);
}

declare global {
    interface WindowEventMap {
        [WORKFLOW_LOG_EVENT_NAME]: CustomEvent<WorkflowStepEvent>;
    }
}
