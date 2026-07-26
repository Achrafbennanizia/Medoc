import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { tauriInvoke } from "@/services/tauri.service";

export function WorkflowRouteLogger(): null {
    const location = useLocation();

    useEffect(() => {
        const telemetryCall = tauriInvoke<void>("log_workflow_event", {
            event: {
                workflow: "ui_navigation",
                stage: "route_enter",
                step: "route_change",
                route: `${location.pathname}${location.search}`,
                action: "navigate",
                status: "entered",
            },
        });
        void Promise.resolve(telemetryCall).catch(() => {
            /* telemetry must never break navigation */
        });
    }, [location.pathname, location.search]);

    return null;
}
