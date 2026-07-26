import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { emitWorkflowEvent } from "@/systems/practice-host/lib/workflow-log";

export function WorkflowRouteLogger() {
    const location = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        void emitWorkflowEvent({
            step: "route_enter",
            route: location.pathname,
            action: "route_navigation",
            status: navType.toLowerCase(),
            detail: location.search || undefined,
        });
    }, [location.pathname, location.search, navType]);

    return null;
}
