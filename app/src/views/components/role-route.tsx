import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { routeChildPathAllowed } from "../../lib/rbac";

/** Deep-link guard: matches sidebar RBAC via {@link routeChildPathAllowed}. */
export function RoleRoute({ routePath, children }: { routePath: string; children: React.ReactNode }) {
    const rolle = useAuthStore((s) => s.session?.rolle);
    if (!routeChildPathAllowed(routePath, rolle)) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}
