import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useRbac } from "@/lib/use-rbac";
import { useT } from "@/lib/i18n";
import { AccessDeniedView } from "./rbac-gate";

/**
 * Central authorization guard for all nested routes: hides page content when the
 * current URL is not allowed for the signed-in role (FA-PERS-07 overrides included).
 */
export function RouteOutletGuard({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const { canLocation, role } = useRbac();
    const t = useT();

    if (!canLocation(pathname)) {
        return (
            <AccessDeniedView
                detail={role != null ? t("rbac.route_locked") : t("rbac.please_sign_in")}
            />
        );
    }

    return <>{children}</>;
}