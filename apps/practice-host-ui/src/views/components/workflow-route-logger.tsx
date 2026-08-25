import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { emitWorkflowEventFireAndForget } from "@/services/workflow-logger.service";

export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        emitWorkflowEventFireAndForget({
            step: "route_enter",
            route: location.pathname,
            outcome: "entered",
        });
    }, [location.pathname]);

    return null;
}
