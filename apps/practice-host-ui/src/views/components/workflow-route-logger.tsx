import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { logRouteEnter } from "@/services/tauri.service";

/**
 * Emits sanitized route-enter workflow events to the backend workflow channel.
 * Logging is best-effort and never blocks navigation.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();
    const lastKeyRef = useRef<string>("");

    useEffect(() => {
        const key = `${location.pathname}${location.search}`;
        if (key === lastKeyRef.current) {
            return;
        }
        lastKeyRef.current = key;
        logRouteEnter(location.pathname);
    }, [location.pathname, location.search]);

    return null;
}
