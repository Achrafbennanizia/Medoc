import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { logWorkflowRouteEnter } from "@/services/workflow-logger.service";

export function WorkflowRouteObserver() {
    const location = useLocation();

    useEffect(() => {
        logWorkflowRouteEnter(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);

    return null;
}
