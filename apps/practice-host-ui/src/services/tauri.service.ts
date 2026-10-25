import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri v2 resolves each command parameter from the invoke JSON using an explicit key.
 * `tauri_macros` defaults to **camelCase** keys derived from Rust identifiers (`patient_id` → `patientId`).
 * Many controllers still send **snake_case** keys; that yields `{}` lookups / missing-key errors.
 *
 * We mirror snake_case ↔ camelCase **at the top level only** so either spelling reaches Rust.
 * Also strips `undefined` so serialization cannot drop required keys silently.
 */

function omitUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    for (const [k, version] of Object.entries(record)) {
        if (version !== undefined) {
            o[k] = version;
        }
    }
    return o;
}

/** `patient_id` → `patientId` (matches `heck::ToLowerCamelCase` / Tauri command IPC keys). */
function snakeToLowerCamel(ident: string): string {
    return ident.replace(/_+([a-zA-Z])/g, (_, ch: string) => ch.toUpperCase());
}

/** `patientId` → `patient_id` */
function camelToSnake(ident: string): string {
    return ident.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
}

function expandDualCaseInvokeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...args };
    for (const [k, version] of Object.entries(args)) {
        if (version === undefined) {
            continue;
        }
        if (k.includes("_")) {
            const camel = snakeToLowerCamel(k);
            if (!(camel in out)) {
                out[camel] = version;
            }
        } else if (/[a-z]/.test(k) && /[A-Z]/.test(k)) {
            const snake = camelToSnake(k);
            if (!(snake in out)) {
                out[snake] = version;
            }
        }
    }
    return out;
}

type WorkflowEventPayload = {
    phase: string;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
    durationMs?: number;
};

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const SECRET_PAIR_RE = /(password|token|secret|api[_-]?key|license)\s*[:=]\s*\S+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function nowMs(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function isTauriDesktopRuntime(): boolean {
    if (typeof window === "undefined") return false;
    return "__TAURI_INTERNALS__" in window;
}

function sanitizeDetail(raw: unknown): string | undefined {
    if (raw == null) return undefined;
    const text = String(raw).trim();
    if (!text) return undefined;
    const scrubbedSecrets = text.replace(
        SECRET_PAIR_RE,
        (_all, key: string) => `${String(key).toLowerCase()}=***`,
    );
    const scrubbedJwt = scrubbedSecrets.replace(JWT_RE, "eyJ***");
    return scrubbedJwt.slice(0, 512);
}

async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    if (!isTauriDesktopRuntime()) return;
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Best-effort logging; never block UI actions on telemetry failures.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const startedAt = nowMs();
    if (cmd !== WORKFLOW_LOG_COMMAND) {
        void emitWorkflowEvent({
            phase: "primary_action",
            action: cmd,
            status: "start",
        });
    }
    const payload = (() => {
        if (args == null) return {};
        const cleaned = omitUndefinedValues(args);
        return expandDualCaseInvokeArgs(cleaned);
    })();
    try {
        const result = await invoke<T>(cmd, payload);
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            void emitWorkflowEvent({
                phase: "primary_action",
                action: cmd,
                status: "success",
                durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            void emitWorkflowEvent({
                phase: "primary_action",
                action: cmd,
                status: "error",
                detail: sanitizeDetail(error),
                durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
            });
        }
        throw error;
    }
}
