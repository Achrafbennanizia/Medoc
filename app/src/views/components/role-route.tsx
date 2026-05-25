import { useAuthStore } from "../../models/store/auth-store";
import { routeChildPathAllowed } from "../../lib/rbac";
import { AccessDeniedView } from "./rbac-gate";

/** Deep-link guard: matches sidebar RBAC via {@link routeChildPathAllowed}. */
export function RoleRoute({ routePath, children }: { routePath: string; children: React.ReactNode }) {
    const session = useAuthStore((s) => s.session);
    if (!routeChildPathAllowed(routePath, session?.rolle, session?.permission_overrides)) {
        return <AccessDeniedView />;
    }
    return <>{children}</>;
}
