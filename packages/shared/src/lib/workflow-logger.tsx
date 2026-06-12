import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowEvent } from "@/systems/practice-host/controllers/logging.controller";
import { useToastStore } from "@/views/components/ui/toast-store";

const CANCEL_ACTION_TOKENS = ["abbrechen", "cancel", "schließen", "close", "zurück", "zurueck"];
const UUID_SEGMENT =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_ID_SEGMENT = /^[0-9a-z_-]{12,}$/i;
const NUMERIC_SEGMENT = /^\d{3,}$/;

type WorkflowEvent = {
    event: string;
    source?: string;
    workflow?: string;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
    error?: string;
};

function isWorkflowLoggerDisabled(): boolean {
    const maybeProcess = (globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    }).process;
    if (maybeProcess?.env?.VITEST === "true") {
        return true;
    }
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
        return true;
    }
    return false;
}

function normalizeRoute(pathname: string): string {
    const segments = pathname.split("/").map((segment) => {
        if (!segment) {
            return segment;
        }
        const decoded = decodeURIComponent(segment);
        if (UUID_SEGMENT.test(decoded) || NUMERIC_SEGMENT.test(decoded) || LONG_ID_SEGMENT.test(decoded)) {
            return ":id";
        }
        return decoded.toLowerCase();
    });
    return segments.join("/");
}

function emitWorkflowEvent(input: WorkflowEvent): void {
    if (isWorkflowLoggerDisabled()) {
        return;
    }
    void logWorkflowEvent({
        source: "frontend",
        workflow: "ui_workflow",
        ...input,
    }).catch(() => {
        // Best-effort telemetry: avoid UI regressions when logging is unavailable.
    });
}

function classifyClickAction(target: Element): "primary_action" | "cancel" | null {
    const button = target.closest("button, [role='button'], a[href]");
    if (!button) {
        return null;
    }
    if (button.getAttribute("data-workflow-cancel") === "true") {
        return "cancel";
    }
    if (button.getAttribute("data-workflow-primary") === "true") {
        return "primary_action";
    }
    if (button instanceof HTMLButtonElement && button.type === "submit") {
        return "primary_action";
    }
    if (button.classList.contains("btn-accent")) {
        return "primary_action";
    }
    const label = (button.getAttribute("aria-label") ?? button.textContent ?? "").trim().toLowerCase();
    if (label && CANCEL_ACTION_TOKENS.some((token) => label.includes(token))) {
        return "cancel";
    }
    return null;
}

function normalizeRuntimeError(value: unknown): string {
    if (value instanceof Error) {
        return value.name || "error";
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return "error_string";
    }
    return "unknown_error";
}

export function WorkflowLoggerBridge() {
    const location = useLocation();
    const route = normalizeRoute(location.pathname);

    useEffect(() => {
        emitWorkflowEvent({
            event: "route_enter",
            route,
            status: "enter",
        });
    }, [route]);

    useEffect(() => {
        if (isWorkflowLoggerDisabled()) {
            return;
        }

        const onClickCapture = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const workflowEvent = classifyClickAction(target);
            if (!workflowEvent) {
                return;
            }
            emitWorkflowEvent({
                event: workflowEvent,
                route,
                action: workflowEvent === "primary_action" ? "ui_primary_control" : "ui_cancel_control",
                status: workflowEvent === "primary_action" ? "pending" : "cancelled",
            });
        };

        const onKeyDownCapture = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                emitWorkflowEvent({
                    event: "cancel",
                    route,
                    action: "escape_key",
                    status: "cancelled",
                });
                return;
            }
            if (event.key === "Enter") {
                const target = event.target;
                if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) {
                    emitWorkflowEvent({
                        event: "primary_action",
                        route,
                        action: "enter_key",
                        status: "pending",
                    });
                }
            }
        };

        const onWindowError = (event: ErrorEvent) => {
            emitWorkflowEvent({
                event: "error",
                route,
                status: "error",
                action: "window_error",
                error: normalizeRuntimeError(event.error ?? event.message),
            });
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            emitWorkflowEvent({
                event: "error",
                route,
                status: "error",
                action: "promise_rejection",
                error: normalizeRuntimeError(event.reason),
            });
        };

        document.addEventListener("click", onClickCapture, true);
        window.addEventListener("keydown", onKeyDownCapture, true);
        window.addEventListener("error", onWindowError);
        window.addEventListener("unhandledrejection", onUnhandledRejection);

        return () => {
            document.removeEventListener("click", onClickCapture, true);
            window.removeEventListener("keydown", onKeyDownCapture, true);
            window.removeEventListener("error", onWindowError);
            window.removeEventListener("unhandledrejection", onUnhandledRejection);
        };
    }, [route]);

    useEffect(() => {
        if (isWorkflowLoggerDisabled()) {
            return;
        }
        const unsubscribe = useToastStore.subscribe((state, prevState) => {
            if (state.toasts.length <= prevState.toasts.length) {
                return;
            }
            const latest = state.toasts[state.toasts.length - 1];
            if (!latest) {
                return;
            }
            if (latest.type === "error") {
                emitWorkflowEvent({
                    event: "error",
                    route,
                    action: "toast",
                    status: "error",
                    detail: "toast_error",
                    error: "ui_toast_error",
                });
                return;
            }
            if (latest.type === "success") {
                emitWorkflowEvent({
                    event: "success",
                    route,
                    action: "toast",
                    status: "success",
                    detail: "toast_success",
                });
            }
        });
        return () => unsubscribe();
    }, [route]);

    return null;
}
