/**
 * React hook for client-side authn/authz (mirrors Rust `rbac` + session overrides).
 */
import { useMemo } from "react";
import { useAuthStore } from "@/models/store/auth-store";
import {
    allowed,
    canReadFinance as roleCanReadFinance,
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
    const role = parseRole(session?.role);
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
            /** Common clinical / front-desk gates (mirrors backend RBAC). */
            canViewClinical: role != null && allowed("patient.read_medical", role, overrides),
            canWriteMedical: role != null && allowed("patient.write_medical", role, overrides),
            canReadDocuments: role != null && allowed("patient.read_documents", role, overrides),
            canWritePatient: role != null && allowed("patient.write", role, overrides),
            canWritePracticePlanning: role != null && allowed("administration.practice_planning.write", role, overrides),
            canReadFinance: role != null && roleCanReadFinance(role, overrides),
            canReadAudit: role != null && allowed("audit.read", role, overrides),
            canOpsSystem: role != null && allowed("ops.system", role, overrides),
            canOpsDsgvo: role != null && allowed("ops.dsgvo", role, overrides),
            canDayCloseWrite: role != null && allowed("finance.day_close.write", role, overrides),
            canReceptionFinanceView: role != null && allowed("finance.reception.view", role, overrides),
            satisfies: (visibility: NavVisibility) =>
                navVisibilitySatisfied(visibility, session?.role, overrides),
            canRoute: (routePath: string) => routeChildPathAllowed(routePath, session?.role, overrides),
            canLocation: (pathname: string) => routeLocationAllowed(pathname, session?.role, overrides),
            canSettingsSection: (section: string) =>
                settingsSectionVisible(section, session?.role, overrides),
        }),
        [session, role, overrides],
    );
}
