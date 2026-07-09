import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logRouteEnter } from "@/systems/practice-host/lib/workflow-log";

/** Emits a workflow event whenever the active route changes. */
export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        const route = `${location.pathname}${location.search}${location.hash}`;
        logRouteEnter(route);
    }, [location.pathname, location.search, location.hash]);

    return null;
}
