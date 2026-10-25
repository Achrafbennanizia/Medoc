import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { emitWorkflowEvent } from "@/services/tauri.service";

export function WorkflowRouteLogger() {
    const location = useLocation();
    const lastRouteKey = useRef<string>("");

    useEffect(() => {
        const route = location.pathname || "/";
        const routeKey = `${route}?${location.search}`;
        if (routeKey === lastRouteKey.current) {
            return;
        }
        lastRouteKey.current = routeKey;
        void emitWorkflowEvent({
            stage: "route_enter",
            workflow: "route",
            route,
            detail: location.search ? "has_query=true" : undefined,
        });
    }, [location.pathname, location.search]);

    return null;
}
