import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowUiStep } from "@/services/tauri.service";

/**
 * Emits route-enter workflow events for every navigation step.
 * This keeps route telemetry in the same sanitized backend channel as IPC events.
 */
export function WorkflowRouteBridge() {
    const location = useLocation();
    const lastRouteRef = useRef<string>("");

    useEffect(() => {
        const route = `${location.pathname}${location.search}${location.hash}`;
        if (route === lastRouteRef.current) {
            return;
        }
        lastRouteRef.current = route;
        logWorkflowUiStep("route_enter", {
            action: "navigation",
            status: "entered",
            route,
        });
    }, [location.pathname, location.search, location.hash]);

    return null;
}
