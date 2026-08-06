import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import { emitWorkflowEvent, summarizeInvokeArgs } from "@/systems/practice-host/lib/workflow-log";
import type { PracticeSystemPort } from "../ports/practice-system.port";

/** Adapter — Practice Host via Tauri IPC (current production path). */
export class TauriPracticeAdapter implements PracticeSystemPort {
    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        // Prevent recursive instrumentation when the workflow bridge itself logs.
        if (command === "log_workflow_event") {
            return tauriInvoke<T>(command, args);
        }
        const startMs = Date.now();
        await emitWorkflowEvent({
            step: "primary_action",
            action: `tauri:${command}`,
            status: "started",
            detail: summarizeInvokeArgs(args),
        });
        try {
            const result = await tauriInvoke<T>(command, args);
            await emitWorkflowEvent({
                step: "success",
                action: `tauri:${command}`,
                status: "ok",
                detail: `durationMs=${Date.now() - startMs}`,
            });
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await emitWorkflowEvent({
                step: "error",
                action: `tauri:${command}`,
                status: "failed",
                detail: `durationMs=${Date.now() - startMs}; message=${message}`,
            });
            throw error;
        }
    }
}

export { practiceSystem, createPracticeSystem, resetPracticeTransportCache } from "./practice-transport";
