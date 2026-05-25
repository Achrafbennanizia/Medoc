import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useRbac } from "@/lib/use-rbac";
import { AccessDeniedView } from "./rbac-gate";

/**
 * Central authorization guard for all nested routes: hides page content when the
 * current URL is not allowed for the signed-in role (FA-PERS-07 overrides included).
 */
export function RouteOutletGuard({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const { canLocation, role } = useRbac();

    if (!canLocation(pathname)) {
        return (
            <AccessDeniedView
                detail={
                    role != null
                        ? "Diese Seite ist für Ihre Rolle gesperrt. Wenden Sie sich an die Praxisleitung, wenn Sie Zugriff benötigen."
                        : "Bitte melden Sie sich an."
                }
            />
        );
    }

    return <>{children}</>;
}
