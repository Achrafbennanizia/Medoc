import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowRouteEnter } from "@/services/tauri.service";

/**
 * Emits a workflow route-enter event whenever the URL path changes.
 * The backend command performs final sanitization before writing to disk.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        void logWorkflowRouteEnter(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);

    return null;
}
