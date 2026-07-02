import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";
import type { NavVisibility, Role } from "@/lib/rbac";

type CanBaseProps = {
    children: ReactNode;
    /** Shown when access is denied (default: hide). */
    fallback?: ReactNode;
};

/** Render children only when the user has a permission action. */
export function Can({
    action,
    children,
    fallback = null,
}: CanBaseProps & { action: string }) {
    const { can } = useRbac();
    return can(action) ? <>{children}</> : <>{fallback}</>;
}

/** Render when any listed action is allowed. */
export function CanAny({
    actions,
    children,
    fallback = null,
}: CanBaseProps & { actions: readonly string[] }) {
    const { canAny } = useRbac();
    return canAny(actions) ? <>{children}</> : <>{fallback}</>;
}

/** Render when all listed actions are allowed. */
export function CanAll({
    actions,
    children,
    fallback = null,
}: CanBaseProps & { actions: readonly string[] }) {
    const { canAll } = useRbac();
    return canAll(actions) ? <>{children}</> : <>{fallback}</>;
}

/** Render only for listed roles. */
export function CanRole({
    roles,
    children,
    fallback = null,
}: CanBaseProps & { roles: readonly Role[] }) {
    const { canRoles } = useRbac();
    return canRoles(roles) ? <>{children}</> : <>{fallback}</>;
}

/** Render when {@link NavVisibility} is satisfied (same rules as sidebar / routes). */
export function CanAccess({
    visibility,
    children,
    fallback = null,
}: CanBaseProps & { visibility: NavVisibility }) {
    const { satisfies } = useRbac();
    return satisfies(visibility) ? <>{children}</> : <>{fallback}</>;
}

/** Render when route key from {@link ROUTE_VISIBILITY} is allowed. */
export function CanRoute({
    routePath,
    children,
    fallback = null,
}: CanBaseProps & { routePath: string }) {
    const { canRoute } = useRbac();
    return canRoute(routePath) ? <>{children}</> : <>{fallback}</>;
}

/** Full-page message when a route or section is not permitted. */
export function AccessDeniedView({
    title,
    detail,
}: {
    title?: string;
    detail?: string;
}) {
    const t = useT();
    return (
        <div className="card card-pad animate-fade-in" role="alert" style={{ maxWidth: 520, margin: "24px auto" }}>
            <h2 className="page-title" style={{ fontSize: "1.15rem" }}>
                {title ?? t("rbac.access_denied_title")}
            </h2>
            <p className="page-sub" style={{ marginTop: 8 }}>
                {detail ?? t("rbac.access_denied_detail")}
            </p>
            <p style={{ marginTop: 16 }}>
                <Link to="/" className="btn btn-primary">
                    {t("rbac.to_dashboard")}
                </Link>
            </p>
        </div>
    );
}