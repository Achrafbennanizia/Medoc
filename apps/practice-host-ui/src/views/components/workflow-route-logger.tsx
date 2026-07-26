import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowEvent } from "@/services/tauri.service";

export function WorkflowRouteLogger(): null {
    const location = useLocation();

    useEffect(() => {
        void logWorkflowEvent({
            workflow: "ui_navigation",
            stage: "route_enter",
            step: "route_change",
            route: `${location.pathname}${location.search}`,
            action: "navigate",
            status: "entered",
        }).catch(() => {
            /* telemetry must never break navigation */
        });
    }, [location.pathname, location.search]);

    return null;
}
