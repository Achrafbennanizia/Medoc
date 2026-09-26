import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { logWorkflowEvent } from "@/services/tauri.service";

export function WorkflowRouteLogger() {
    const location = useLocation();
    const previousRoute = useRef<string | null>(null);

    useEffect(() => {
        const route = `${location.pathname}${location.search}`;
        if (previousRoute.current === route) {
            return;
        }
        previousRoute.current = route;
        void logWorkflowEvent({
            phase: "route_enter",
            step: "route.enter",
            route,
        });
    }, [location.pathname, location.search]);

    return null;
}
