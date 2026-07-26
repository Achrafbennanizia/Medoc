import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordWorkflowRouteEnter } from "@/services/tauri.service";

/**
 * Emits sanitized route-enter workflow events to the backend workflow log channel.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        void recordWorkflowRouteEnter(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);

    return null;
}
