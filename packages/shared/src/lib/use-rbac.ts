/**
 * React hook for client-side authn/authz (mirrors Rust `rbac` + session overrides).
 */
import { useMemo } from "react";
import { useAuthStore } from "@/models/store/auth-store";
import {
    allowed,
    navVisibilitySatisfied,
    parseRole,
    routeChildPathAllowed,
    routeLocationAllowed,
    settingsSectionVisible,
    type NavVisibility,
    type Role,
} from "./rbac";

export function useRbac() {
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const overrides = session?.permission_overrides;

    return useMemo(
        () => ({
            session,
            role,
            isAuthenticated: session != null,
            /** Permission action (e.g. `patient.read_medical`). */
            can: (action: string) => (role != null ? allowed(action, role, overrides) : false),
            canAny: (actions: readonly string[]) =>
                role != null && actions.some((a) => allowed(a, role, overrides)),
            canAll: (actions: readonly string[]) =>
                role != null && actions.every((a) => allowed(a, role, overrides)),
            canRoles: (roles: readonly Role[]) => (role != null ? roles.includes(role) : false),
            satisfies: (visibility: NavVisibility) =>
                navVisibilitySatisfied(visibility, session?.rolle, overrides),
            canRoute: (routePath: string) => routeChildPathAllowed(routePath, session?.rolle, overrides),
            canLocation: (pathname: string) => routeLocationAllowed(pathname, session?.rolle, overrides),
            canSettingsSection: (section: string) =>
                settingsSectionVisible(section, session?.rolle, overrides),
        }),
        [session, role, overrides],
    );
}
