import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowRouteStep } from "@/services/tauri.service";

function currentRouteLabel(
    pathname: string,
    search: string,
    hash: string,
): string {
    return `${pathname}${search}${hash}`;
}

/**
 * Emits route-entry/exit workflow events for the dedicated workflow channel.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();
    const previousRouteRef = useRef<string | null>(null);

    useEffect(() => {
        const route = currentRouteLabel(
            location.pathname,
            location.search,
            location.hash,
        );
        const previous = previousRouteRef.current;
        if (previous && previous !== route) {
            void logWorkflowRouteStep(previous, "route_leave");
        }
        void logWorkflowRouteStep(route, "route_enter");
        previousRouteRef.current = route;
    }, [location.pathname, location.search, location.hash]);

    return null;
}
