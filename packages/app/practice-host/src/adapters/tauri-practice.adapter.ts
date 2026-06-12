import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import type { PracticeSystemPort } from "../ports/practice-system.port";

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

type WorkflowLogEventInput = {
    event: string;
    source: string;
    workflow: string;
    command: string;
    status: "start" | "success" | "error";
    error?: string;
};

function shouldEmitWorkflowIpcLogs(): boolean {
    const maybeProcess = (globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    }).process;
    if (maybeProcess?.env?.VITEST === "true") {
        return false;
    }
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
        return false;
    }
    return true;
}

function normalizeCommandName(command: string): string {
    const normalized = command.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_");
    if (!normalized) {
        return "unknown";
    }
    return normalized.slice(0, 160);
}

async function emitWorkflowEvent(input: WorkflowLogEventInput): Promise<void> {
    if (!shouldEmitWorkflowIpcLogs()) {
        return;
    }
    try {
        await tauriInvoke<void>(WORKFLOW_LOG_COMMAND, { input });
    } catch {
        // Workflow telemetry must never block command execution.
    }
}

/** Adapter — Practice Host via Tauri IPC (current production path). */
export class TauriPracticeAdapter implements PracticeSystemPort {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        if (command === WORKFLOW_LOG_COMMAND) {
            return tauriInvoke<T>(command, args);
        }

        const commandName = normalizeCommandName(command);
        void emitWorkflowEvent({
            event: "tauri_command_start",
            source: "ipc",
            workflow: "tauri_ipc",
            command: commandName,
            status: "start",
        });

        return tauriInvoke<T>(command, args)
            .then((result) => {
                void emitWorkflowEvent({
                    event: "tauri_command_success",
                    source: "ipc",
                    workflow: "tauri_ipc",
                    command: commandName,
                    status: "success",
                });
                return result;
            })
            .catch((error: unknown) => {
                const errorCode = error instanceof Error ? error.name : "invoke_error";
                void emitWorkflowEvent({
                    event: "tauri_command_error",
                    source: "ipc",
                    workflow: "tauri_ipc",
                    command: commandName,
                    status: "error",
                    error: errorCode,
                });
                throw error;
            });
    }
}

export { practiceSystem, createPracticeSystem, resetPracticeTransportCache } from "./practice-transport";
