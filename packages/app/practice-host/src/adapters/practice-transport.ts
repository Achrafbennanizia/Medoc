/**
 * **Factory** — selects Practice Host transport (Tauri IPC vs LAN HTTPS).
 *
 * - `practice_desktop` / `serverless_peer` → local SQLite via Tauri IPC
 * - `lan_client` → remote `medoc-server` over HTTPS (no local DB)
 */
import { isLanClientActive } from "@/systems/lan/lib/lan-client-config";
import { isLanClientOnly } from "@/systems/practice-host/lib/deployment-config";
import { argsToIpc, resultFromIpc } from "@/lib/ipc-bridge";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { HttpPracticeAdapter } from "./http-practice.adapter";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";

const DEPLOYMENT_MODE_KEY = "medoc.deployment.mode.v1";
const WORKFLOW_LOG_COMMAND = "log_workflow_step";
const WORKFLOW_CONTEXT_KEYS_LIMIT = 12;
const WORKFLOW_TELEMETRY_FLAG = "__MEDOC_WORKFLOW_TELEMETRY__";

let cached: PracticeSystemPort | null = null;
let cachedLan = false;

export type WorkflowPhase = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowStepPayload = {
    workflow: string;
    step: string;
    phase: WorkflowPhase;
    route?: string;
    action?: string;
    status?: string;
    message?: string;
    context?: Record<string, unknown>;
};

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

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined" || typeof window.location?.pathname !== "string") return undefined;
    const path = window.location.pathname.trim();
    return path.length > 0 ? path : "/";
}

function summarizeArgs(args?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!args) return undefined;
    return {
        argKeys: Object.keys(args).slice(0, WORKFLOW_CONTEXT_KEYS_LIMIT),
    };
}

function extractStatus(result: unknown): string | undefined {
    if (!result || typeof result !== "object") return undefined;
    const status = (result as { status?: unknown }).status;
    return typeof status === "string" && status.trim().length > 0 ? status : undefined;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

async function sendWorkflowStep(
    system: PracticeSystemPort,
    payload: WorkflowStepPayload,
): Promise<void> {
    if (cachedLan || !workflowTelemetryEnabled()) return;
    const event = {
        workflow: payload.workflow,
        step: payload.step,
        phase: payload.phase,
        route: payload.route,
        action: payload.action,
        status: payload.status,
        message: payload.message,
        context: payload.context ?? {},
    };
    await system.invoke<void>(WORKFLOW_LOG_COMMAND, { event });
}

function emitWorkflowStep(system: PracticeSystemPort, payload: WorkflowStepPayload): void {
    void sendWorkflowStep(system, payload).catch(() => {
        // Logging telemetry must never break user actions.
    });
}

function workflowTelemetryEnabled(): boolean {
    const forced = (globalThis as Record<string, unknown>)[WORKFLOW_TELEMETRY_FLAG];
    if (typeof forced === "boolean") return forced;
    if (typeof process !== "undefined" && process.env?.VITEST) return false;
    return true;
}

export async function logWorkflowRouteEnter(route: string): Promise<void> {
    const system = createPracticeSystem();
    const normalizedRoute = route.trim().length > 0 ? route.trim() : "/";
    try {
        await sendWorkflowStep(system, {
            workflow: "ui_route",
            step: normalizedRoute,
            phase: "route_enter",
            route: normalizedRoute,
        });
    } catch {
        // Route logging is best-effort.
    }
}

export async function logWorkflowStep(payload: WorkflowStepPayload): Promise<void> {
    const system = createPracticeSystem();
    try {
        await sendWorkflowStep(system, payload);
    } catch {
        // Workflow telemetry is best-effort.
    }
}

/** Facade — re-resolves when LAN client config changes (page reload recommended). */
export const practiceSystem: PracticeSystemPort = {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        const system = createPracticeSystem();
        const mappedArgs = argsToIpc(command, args);
        if (command !== WORKFLOW_LOG_COMMAND) {
            emitWorkflowStep(system, {
                workflow: "service_call",
                step: command,
                phase: "primary_action",
                route: currentRoutePath(),
                action: command,
                context: summarizeArgs(mappedArgs),
            });
        }
        return system
            .invoke<T>(command, mappedArgs)
            .then((row) => {
                if (command !== WORKFLOW_LOG_COMMAND) {
                    emitWorkflowStep(system, {
                        workflow: "service_call",
                        step: command,
                        phase: "success",
                        route: currentRoutePath(),
                        action: command,
                        status: extractStatus(row),
                    });
                }
                return resultFromIpc(command, row);
            })
            .catch((error: unknown) => {
                if (command !== WORKFLOW_LOG_COMMAND) {
                    emitWorkflowStep(system, {
                        workflow: "service_call",
                        step: command,
                        phase: "error",
                        route: currentRoutePath(),
                        action: command,
                        message: errorMessage(error),
                    });
                }
                throw error;
            });
    },
};

export function resetPracticeTransportCache(): void {
    cached = null;
}
