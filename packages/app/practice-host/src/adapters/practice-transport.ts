/**
 * **Factory** — selects Practice Host transport (Tauri IPC vs LAN HTTPS).
 *
 * - `practice_desktop` / `serverless_peer` → local SQLite via Tauri IPC
 * - `lan_client` → remote `medoc-server` over HTTPS (no local DB)
 */
import { isLanClientActive } from "@/systems/lan/lib/lan-client-config";
import { isLanClientOnly } from "@/systems/practice-host/lib/deployment-config";
import { argsToIpc, resultFromIpc } from "@/lib/ipc-bridge";
import {
    extractWorkflowErrorCode,
    normalizeWorkflowRoute,
    normalizeWorkflowToken,
} from "@/systems/practice-host/lib/workflow-log";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { HttpPracticeAdapter } from "./http-practice.adapter";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";

const DEPLOYMENT_MODE_KEY = "medoc.deployment.mode.v1";
const WORKFLOW_LOG_COMMAND = "log_workflow_event";

let cached: PracticeSystemPort | null = null;
let cachedLan = false;

type InvokeWorkflowPhase = "primary_action" | "success" | "error";

function readDeploymentMode(): string {
    try {
        return localStorage.getItem(DEPLOYMENT_MODE_KEY) ?? "practice_desktop";
    } catch {
        return "practice_desktop";
    }
}

export function setDeploymentModeCache(mode: string): void {
    try {
        localStorage.setItem(DEPLOYMENT_MODE_KEY, mode);
    } catch {
        /* ignore */
    }
    resetPracticeTransportCache();
}

export function createPracticeSystem(): PracticeSystemPort {
    const mode = readDeploymentMode();
    const lan = isLanClientOnly(mode as "lan_client") || (mode !== "serverless_peer" && isLanClientActive());
    if (cached && cachedLan === lan) {
        return cached;
    }
    cachedLan = lan;
    cached = lan ? new HttpPracticeAdapter() : new TauriPracticeAdapter();
    return cached;
}

function shouldEmitInvokeWorkflow(command: string, transport: PracticeSystemPort): boolean {
    if (command === WORKFLOW_LOG_COMMAND) return false;
    if (cachedLan) return false;
    if (!(transport instanceof TauriPracticeAdapter)) return false;
    return typeof window !== "undefined";
}

function emitInvokeWorkflow(
    transport: PracticeSystemPort,
    command: string,
    phase: InvokeWorkflowPhase,
    errorCode?: string,
): void {
    const safeStep = normalizeWorkflowToken(command, "unknown");
    const payload: Record<string, unknown> = {
        workflow: "ui.invoke",
        step: safeStep,
        phase,
        outcome: phase === "error" ? "error" : phase === "success" ? "success" : "started",
        action: safeStep,
        route: normalizeWorkflowRoute(window.location.pathname),
    };
    if (errorCode) payload.errorCode = normalizeWorkflowToken(errorCode, "error.unknown");
    void transport.invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload }).catch(() => {
        // Best-effort channel: avoid breaking the source operation when telemetry fails.
    });
}

/** Facade — re-resolves when LAN client config changes (page reload recommended). */
export const practiceSystem: PracticeSystemPort = {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        const transport = createPracticeSystem();
        const shouldLog = shouldEmitInvokeWorkflow(command, transport);
        if (shouldLog) emitInvokeWorkflow(transport, command, "primary_action");
        return transport
            .invoke<T>(command, argsToIpc(command, args))
            .then((row) => {
                if (shouldLog) emitInvokeWorkflow(transport, command, "success");
                return resultFromIpc(command, row);
            })
            .catch((error: unknown) => {
                if (shouldLog) {
                    emitInvokeWorkflow(
                        transport,
                        command,
                        "error",
                        extractWorkflowErrorCode(error),
                    );
                }
                throw error;
            });
    },
};

export function resetPracticeTransportCache(): void {
    cached = null;
}
