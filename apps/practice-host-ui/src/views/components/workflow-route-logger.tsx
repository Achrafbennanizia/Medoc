import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { tauriInvoke } from "@/services/tauri.service";

const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT_RE = /^\d+$/;
const LONG_ALNUM_SEGMENT_RE = /^[A-Za-z0-9]{12,}$/;
const ENTITY_ID_SEGMENT_RE =
    /^(pat|patient|akte|ticket|rezept|termin|zahlung|bestellung|vertrag|kb)-[A-Za-z0-9_-]+$/i;

function normalizeRoutePath(pathname: string): string {
    const segments = pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            const raw = decodeURIComponent(segment);
            if (
                UUID_SEGMENT_RE.test(raw) ||
                NUMERIC_SEGMENT_RE.test(raw) ||
                LONG_ALNUM_SEGMENT_RE.test(raw) ||
                ENTITY_ID_SEGMENT_RE.test(raw)
            ) {
                return ":id";
            }
            return raw;
        });
    return `/${segments.join("/")}`;
}

/**
 * Frontend workflow telemetry bridge:
 * every route entry is mirrored to the backend workflow log channel.
 */
export function WorkflowRouteLogger() {
    const location = useLocation();

    useEffect(() => {
        void tauriInvoke<void>("workflow_log_event", {
            event: {
                workflow: "ui-route",
                step: "route_enter",
                status: "success",
                route: normalizeRoutePath(location.pathname),
            },
        }).catch(() => {
            // No-op in non-Tauri contexts.
        });
    }, [location.pathname]);

    return null;
}
