import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowRouteEnter } from "@/services/tauri.service";

/**
 * Frontend workflow telemetry bridge:
 * every route entry is mirrored to the backend workflow log channel.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        void logWorkflowRouteEnter(location.pathname);
    }, [location.pathname]);

    return null;
}
