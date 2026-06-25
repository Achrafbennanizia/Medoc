import type { WorkflowStepEvent } from "@/lib/workflow-log-events";
import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

/**
 * Best-effort frontend → backend workflow logging bridge.
 * Failures must never block UX flows, so errors are intentionally swallowed.
 */
export async function logWorkflowStep(event: WorkflowStepEvent): Promise<void> {
    try {
        await practiceSystem.invoke<void>("workflow_log_step", { payload: event });
    } catch {
        // Logging is observational only.
    }
}
