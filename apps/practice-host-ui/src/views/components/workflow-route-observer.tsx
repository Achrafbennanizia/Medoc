import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { logWorkflowRouteEnter } from "@/services/tauri.service";

/**
 * Emits sanitized route-enter workflow events into the backend log channel.
 */
export function WorkflowRouteObserver() {
    const location = useLocation();
    const lastPathRef = useRef<string>("");

    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath === lastPathRef.current) {
            return;
        }
        lastPathRef.current = currentPath;
        void logWorkflowRouteEnter(currentPath);
    }, [location.pathname]);

    return null;
}
