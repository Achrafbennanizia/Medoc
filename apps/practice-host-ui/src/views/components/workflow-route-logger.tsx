import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { recordWorkflowEvent } from "@/services/tauri.service";

export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        const route = `${location.pathname}${location.search ?? ""}`;
        void recordWorkflowEvent({
            stage: "route_enter",
            route,
            action: "route_navigation",
        });
    }, [location.pathname, location.search]);

    return null;
}
