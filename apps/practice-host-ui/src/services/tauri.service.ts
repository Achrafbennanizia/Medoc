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
    for (const [k, v] of Object.entries(record)) {
        if (v !== undefined) {
            o[k] = v;
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
    for (const [k, v] of Object.entries(args)) {
        if (v === undefined) {
            continue;
        }
        if (k.includes("_")) {
            const camel = snakeToLowerCamel(k);
            if (!(camel in out)) {
                out[camel] = v;
            }
        } else if (/[a-z]/.test(k) && /[A-Z]/.test(k)) {
            const snake = camelToSnake(k);
            if (!(snake in out)) {
                out[snake] = v;
            }
        }
    }
    return out;
}

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const ROUTE_DEDUPE_WINDOW_MS = 800;

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";
type WorkflowOutcome = "start" | "success" | "cancel" | "error";

interface WorkflowEventPayload {
    step: WorkflowStep;
    route?: string;
    action?: string;
    command?: string;
    outcome?: WorkflowOutcome;
    error_class?: string;
    duration_ms?: number;
}

let workflowBridgeEnabledOverride: boolean | null = null;
let lastRouteFingerprint = "";
let lastRouteLoggedAt = 0;

const KNOWN_ROUTE_SEGMENTS = new Set([
    "onboarding",
    "aktivierung",
    "abonnement",
    "konto",
    "lizenz",
    "beitreten",
    "login",
    "termine",
    "neu",
    "patienten",
    "rezept",
    "akten",
    "zu-validieren",
    "tickets",
    "bearbeiten",
    "posteingang",
    "finanzen",
    "kasse",
    "bestellungen",
    "bilanz",
    "verwaltung",
    "team",
    "arbeitszeit",
    "aufgaben",
    "arbeitstage",
    "praxisplanung",
    "arbeitszeiten",
    "sonder-sperrzeiten",
    "praxis-praeferenzen",
    "vorlagen",
    "editor",
    "behandlungs-katalog",
    "bestellstamm",
    "finanzen-berichte",
    "tagesabschluss",
    "rechnung",
    "finanzen-werkzeuge",
    "lager-und-bestellwesen",
    "vertraege",
    "leistungen-kataloge-vorlagen",
    "rezepte",
    "atteste",
    "leistungen",
    "produkte",
    "personal",
    "arbeitsplan",
    "krankenbescheinigung",
    "statistik",
    "audit",
    "datenschutz",
    "einstellungen",
    "logs",
    "ops",
    "compliance",
    "hilfe",
    "feedback",
    "migration",
]);

function workflowBridgeEnabled(): boolean {
    if (workflowBridgeEnabledOverride != null) {
        return workflowBridgeEnabledOverride;
    }
    return import.meta.env.MODE !== "test";
}

function readCurrentRouteForLogs(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const pathname = window.location?.pathname ?? "/";
    const search = window.location?.search ?? "";
    return `${pathname}${search}`;
}

function normalizeRouteForLogs(rawRoute: string): string {
    const [pathOnly] = rawRoute.split("?");
    const segments = pathOnly.split("/").filter(Boolean);
    if (segments.length === 0) return "/";
    const normalized = segments.map((segment, index) => {
        if (KNOWN_ROUTE_SEGMENTS.has(segment)) return segment;
        if (index === 0) return segment;
        return ":param";
    });
    return `/${normalized.join("/")}`;
}

function classifyWorkflowOutcomeFromError(error: unknown): WorkflowOutcome {
    const raw = String(error ?? "").toLowerCase();
    if (raw.includes("cancel") || raw.includes("aborted") || raw.includes("dismiss")) {
        return "cancel";
    }
    return "error";
}

function classifyWorkflowErrorClass(error: unknown): string {
    const outcome = classifyWorkflowOutcomeFromError(error);
    if (outcome === "cancel") return "cancelled";
    return "invoke_error";
}

async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    if (!workflowBridgeEnabled()) return;
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { payload });
    } catch {
        // Never let telemetry break product behavior.
    }
}

export async function recordWorkflowRouteEnter(route: string): Promise<void> {
    const normalizedRoute = normalizeRouteForLogs(route);
    const now = Date.now();
    if (
        normalizedRoute === lastRouteFingerprint &&
        now - lastRouteLoggedAt <= ROUTE_DEDUPE_WINDOW_MS
    ) {
        return;
    }
    lastRouteFingerprint = normalizedRoute;
    lastRouteLoggedAt = now;
    await emitWorkflowEvent({
        step: "route_enter",
        route: normalizedRoute,
        action: "enter",
        outcome: "start",
    });
}

export function __setWorkflowBridgeEnabledForTests(enabled: boolean | null): void {
    workflowBridgeEnabledOverride = enabled;
}

export function __resetWorkflowRouteLogDeduperForTests(): void {
    lastRouteFingerprint = "";
    lastRouteLoggedAt = 0;
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, args ?? {});
    }

    const route = readCurrentRouteForLogs();
    const startedAt = Date.now();
    await emitWorkflowEvent({
        step: "primary_action",
        route: route ? normalizeRouteForLogs(route) : undefined,
        action: "invoke",
        command: cmd,
        outcome: "start",
    });

    try {
        const expandedArgs =
            args == null
                ? {}
                : expandDualCaseInvokeArgs(omitUndefinedValues(args));
        const result = await invoke<T>(cmd, expandedArgs);
        await emitWorkflowEvent({
            step: "success",
            route: route ? normalizeRouteForLogs(route) : undefined,
            action: "invoke",
            command: cmd,
            outcome: "success",
            duration_ms: Date.now() - startedAt,
        });
        return result;
    } catch (error) {
        const outcome = classifyWorkflowOutcomeFromError(error);
        await emitWorkflowEvent({
            step: outcome === "cancel" ? "cancel" : "error",
            route: route ? normalizeRouteForLogs(route) : undefined,
            action: "invoke",
            command: cmd,
            outcome,
            error_class: classifyWorkflowErrorClass(error),
            duration_ms: Date.now() - startedAt,
        });
        throw error;
    }
}
