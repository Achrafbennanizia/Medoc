/**
 * Client-side RBAC for navigation and UI gating.
 * Matrix: `config/rbac.yaml` → `rbac.generated.ts` (run `cargo build` to refresh).
 */

import { baseAllowedGenerated, RBAC_ALL_ACTIONS } from "./rbac.generated";
import { PRIVACY_UI_ENABLED } from "./privacy-config";
import { INBOX_UI_ENABLED } from "./inbox-config";
import {
    SERVICES_MENU_ENABLED,
    PRODUCTS_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "./catalog-menu-flags";
import {
    NOTIFICATIONS_SETTINGS_ENABLED,
    INTEGRATIONS_SETTINGS_ENABLED,
    MIGRATION_SETTINGS_ENABLED,
} from "./settings-ui-flags";
import type { PermissionOverride } from "../models/types";
import {
    ACTIVE_ROLE_WIRES,
    type ActiveRoleWire,
    isDeferredRoleWire,
} from "./deferred-roles";

export type { PermissionOverride };

export { RBAC_ALL_ACTIONS };

/** Finance read access: full overview or cash area (Reception). */
export const FINANCE_READ_OR_RECEPTION = ["finance.read", "finance.reception.view"] as const;

/** Clinical chart capabilities (staff “full chart read-only” preset). */
export const PATIENT_READ_MEDICAL = "patient.read_medical";
export const PATIENT_WRITE_MEDICAL = "patient.write_medical";

export function canReadFinance(
    role: Role,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return FINANCE_READ_OR_RECEPTION.some((action) => allowed(action, role, overrides));
}

/** True when medical chart may be viewed but not mutated (role + overrides). */
export function canViewFullChartReadonly(
    role: Role,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return (
        allowed(PATIENT_READ_MEDICAL, role, overrides)
        && !allowed(PATIENT_WRITE_MEDICAL, role, overrides)
    );
}

/** Whether the staff FA-PERS-07 preset rows are active (ALLOW read + DENY write). */
export function isFullChartReadonlyOverrideActive(
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (overrides == null || overrides.length === 0) return false;
    const read = overrides.find((o) => o.action === PATIENT_READ_MEDICAL);
    const write = overrides.find((o) => o.action === PATIENT_WRITE_MEDICAL);
    return read?.effect === "ALLOW" && write?.effect === "DENY";
}

/** MVP active login roles. TODO(deferred-roles): restore TAX_ADVISOR | PHARMA_CONSULTANT. */
export type Role = ActiveRoleWire;
// export type Role = "PHYSICIAN" | "RECEPTION" | "TAX_ADVISOR" | "PHARMA_CONSULTANT";

export function parseRole(s: string | undefined): Role | null {
    if (isDeferredRoleWire(s)) return null;
    if (s === "PHYSICIAN" || s === "RECEPTION") {
        return s;
    }
    // TODO(deferred-roles): || s === "TAX_ADVISOR" || s === "PHARMA_CONSULTANT"
    return null;
}

/** Role matrix without overrides — generated from `config/rbac.yaml`. */
function baseAllowed(action: string, role: Role): boolean {
    return baseAllowedGenerated(action, role);
}

/** Mirrors Rust `effective_allowed` (FA-PERS-07): Overrides schlagen die Rollenmatrix. */
export function allowed(
    action: string,
    role: Role,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (overrides != null && overrides.length > 0) {
        const hit = overrides.find((o) => o.action === action);
        if (hit) return hit.effect === "ALLOW";
    }
    return baseAllowed(action, role);
}

export type NavVisibility =
    | { kind: "action"; action: string }
    | { kind: "allOf"; actions: readonly string[] }
    | { kind: "anyOf"; actions: readonly string[] }
    | { kind: "roles"; roles: readonly Role[] };

export type NavItemDefinition = {
    to: string;
    labelKey: string;
    visibility: NavVisibility;
};

export function navItemVisible(
    role: string | undefined,
    item: NavItemDefinition,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return navVisibilitySatisfied(item.visibility, role, overrides);
}

/**
 * Sidebar navigation: each entry is gated by the same capability checks the backend uses,
 * except where no single Tauri permission exists yet (see inline comments).
 */
export const NAV_ITEM_DEFINITIONS: NavItemDefinition[] = [
    {
        to: "/",
        labelKey: "nav.dashboard",
        visibility: { kind: "action", action: "dashboard.read" },
    },
    { to: "/appointments", labelKey: "nav.appointments", visibility: { kind: "action", action: "appointment.read" } },
    { to: "/patients", labelKey: "nav.patients", visibility: { kind: "action", action: "patient.read" } },
    { to: "/charts/to-validate", labelKey: "nav.charts_to_validate", visibility: { kind: "action", action: "patient.read_medical" } },
    ...(INBOX_UI_ENABLED
        ? [{ to: "/inbox", labelKey: "nav.inbox", visibility: { kind: "roles", roles: ["PHYSICIAN", "RECEPTION"] } } as NavItemDefinition]
        : []),
    { to: "/tickets", labelKey: "nav.practice_tickets", visibility: { kind: "roles", roles: ["PHYSICIAN", "RECEPTION"] } },
    ...(PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED
        ? [{ to: "/prescriptions", labelKey: "nav.prescriptions", visibility: { kind: "action", action: "patient.read_medical" } } as NavItemDefinition]
        : []),
    { to: "/finance", labelKey: "nav.finance", visibility: { kind: "action", action: "finance.read" } },
    {
        to: "/finance/cash",
        labelKey: "nav.finance_reception",
        visibility: { kind: "action", action: "finance.reception.view" },
    },
    { to: "/purchase-orders", labelKey: "nav.purchase-orders", visibility: { kind: "action", action: "purchase_order.read" } },
    ...(SERVICES_MENU_ENABLED
        ? [{ to: "/services", labelKey: "nav.services", visibility: { kind: "anyOf", actions: FINANCE_READ_OR_RECEPTION } } as NavItemDefinition]
        : []),
    { to: "/administration", labelKey: "nav.administration", visibility: { kind: "action", action: "administration.read" } },
    {
        to: "/staff/work-time",
        labelKey: "nav.workTime",
        visibility: { kind: "action", action: "work_time.self" },
    },
    // TODO(deferred-roles): { to: "/statistics", visibility: { kind: "roles", roles: ["PHYSICIAN", "TAX_ADVISOR"] } },
    { to: "/statistics", labelKey: "nav.statistics", visibility: { kind: "roles", roles: ["PHYSICIAN"] } },
    {
        to: "/settings",
        labelKey: "nav.settings",
        visibility: { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    },
];

/**
 * Maps React Router child `path` (the `path` prop under the layout route) to a sidebar `to`
 * used in {@link NAV_ITEM_DEFINITIONS}. Patient detail shares visibility with `/patients`.
 */
export const ROUTE_VISIBILITY: Record<string, NavVisibility> = {
    "": { kind: "action", action: "dashboard.read" },
    "appointments": { kind: "action", action: "appointment.read" },
    "appointments/new": { kind: "action", action: "appointment.write" },
    "patients": { kind: "action", action: "patient.read" },
    "patients/new": { kind: "action", action: "patient.write" },
    "patients/:id": { kind: "action", action: "patient.read" },
    "patients/:id/prescription/new": { kind: "action", action: "patient.write_medical" },
    "patients/:id/prescription/:prescriptionId": { kind: "action", action: "patient.write_medical" },
    "charts/to-validate": { kind: "action", action: "patient.read_medical" },
    "inbox": { kind: "roles", roles: ["PHYSICIAN", "RECEPTION"] },
    tickets: { kind: "roles", roles: ["PHYSICIAN", "RECEPTION"] },
    "tickets/new": { kind: "action", action: "administration.read" },
    "tickets/:id/edit": { kind: "action", action: "administration.read" },
    "tickets/:id/bearbeiten": { kind: "action", action: "administration.read" },
    "finance": { kind: "action", action: "finance.read" },
    "finance/cash": { kind: "action", action: "finance.reception.view" },
    "finance/cash/new": { kind: "action", action: "finance.write" },
    "finance/new": { kind: "action", action: "finance.write" },
    "purchase-orders": { kind: "action", action: "purchase_order.read" },
    "purchase-orders/new": { kind: "action", action: "purchase_order.write" },
    "purchase-orders/:id": { kind: "action", action: "purchase_order.read" },
    // TODO(deferred-roles): balance-sheet — was ["PHYSICIAN", "TAX_ADVISOR"]
    "balance-sheet": { kind: "roles", roles: ["PHYSICIAN"] },
    "balance-sheet/new": { kind: "roles", roles: ["PHYSICIAN"] },
    "prescriptions": { kind: "action", action: "patient.read_medical" },
    "certificates": { kind: "action", action: "patient.read_medical" },
    "services": { kind: "anyOf", actions: FINANCE_READ_OR_RECEPTION },
    "services/new": { kind: "action", action: "finance.write" },
    "products": { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    "staff": { kind: "action", action: "staff.read" },
    "staff/work-plan": { kind: "action", action: "staff.read" },
    "staff/work-time": { kind: "action", action: "work_time.self" },
    "administration/team/work-time": { kind: "action", action: "work_time.team.read" },
    "staff/new": { kind: "action", action: "staff.write" },
    "statistics": { kind: "action", action: "statistics.read" },
    audit: { kind: "action", action: "audit.read" },
    "privacy": { kind: "allOf", actions: ["patient.read", "ops.dsgvo"] },
    "settings": { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    logs: { kind: "action", action: "ops.logs" },
    ops: { kind: "action", action: "ops.backup" },
    compliance: { kind: "anyOf", actions: ["ops.dsgvo", "ops.system"] },
    help: { kind: "action", action: "dashboard.read" },
    feedback: { kind: "action", action: "dashboard.read" },
    migration: { kind: "action", action: "ops.migration" },
    "administration": { kind: "action", action: "administration.read" },
    "administration/tasks": { kind: "action", action: "administration.read" },
    "administration/team": { kind: "action", action: "administration.team.read" },
    "administration/sick-leave-certificate": { kind: "action", action: "administration.team.read" },
    "administration/work-days": { kind: "action", action: "administration.practice_planning.read" },
    "administration/practice-planning": { kind: "action", action: "administration.practice_planning.read" },
    "administration/work-hours": { kind: "action", action: "administration.practice_planning.read" },
    "administration/special-blocked-times": { kind: "action", action: "administration.practice_planning.read" },
    "administration/practice-preferences": { kind: "action", action: "administration.practice_planning.read" },
    "administration/templates": { kind: "action", action: "administration.templates.read" },
    "administration/templates/editor": { kind: "action", action: "administration.templates.write" },
    "administration/treatment-catalog": { kind: "action", action: "patient.read_medical" },
    /** Order management (not `finance.*`) — mirrors Tauri `purchase_order.read` / `purchase_order.write` for practice master data. */
    "administration/order-master": { kind: "action", action: "purchase_order.read" },
    "administration/finance-tools": { kind: "action", action: "finance.read" },
    "administration/day-close": { kind: "action", action: "finance.day_close.write" },
    "administration/finance-reports": { kind: "action", action: "finance.read" },
    "administration/finance-reports/day-close": { kind: "action", action: "finance.day_close.write" },
    "administration/finance-reports/invoice": { kind: "action", action: "finance.read" },
    "administration/inventory-and-ordering": { kind: "action", action: "administration.inventory.read" },
    "administration/contracts": { kind: "action", action: "administration.contracts.read" },
    "administration/services-catalogs-templates": {
        kind: "anyOf",
        actions: ["administration.catalogs.read", "administration.templates.read"],
    },
};

export function navVisibilitySatisfied(
    visibility: NavVisibility,
    role: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (isDeferredRoleWire(role)) return false;
    const parsedRole = parseRole(role);
    if (!parsedRole) return false;
    if (visibility.kind === "action") return allowed(visibility.action, parsedRole, overrides);
    if (visibility.kind === "allOf") {
        return visibility.actions.every((a) => allowed(a, parsedRole, overrides));
    }
    if (visibility.kind === "anyOf") {
        return visibility.actions.some((a) => allowed(a, parsedRole, overrides));
    }
    return visibility.roles.includes(parsedRole);
}

export function routeChildPathAllowed(
    routePath: string,
    role: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (!INBOX_UI_ENABLED && routePath === "inbox") {
        return false;
    }
    if (!PRIVACY_UI_ENABLED && routePath === "privacy") {
        return false;
    }
    if (!PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED && (routePath === "prescriptions" || routePath === "certificates" || routePath.startsWith("administration/templates"))) {
        return false;
    }
    if (!SERVICES_MENU_ENABLED && (routePath === "services" || routePath.startsWith("services/"))) {
        return false;
    }
    if (!PRODUCTS_MENU_ENABLED && routePath === "products") {
        return false;
    }
    const parsedRole = parseRole(role);
    if (parsedRole === "RECEPTION" && routePath.startsWith("administration")) {
        return false;
    }
    const visibility = ROUTE_VISIBILITY[routePath];
    if (!visibility) return false;
    return navVisibilitySatisfied(visibility, parsedRole ?? role, overrides);
}

/** Normalize App route path (no leading slash, no query). */
export function routePathFromLocation(pathname: string): string {
    const p = pathname.replace(/^\//, "").split("?")[0] ?? "";
    if (p === "") return "";
    return p;
}

function routePatternToRegExp(pattern: string): RegExp {
    const parts = pattern.split("/").map((seg) =>
        seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp(`^${parts.join("/")}$`);
}

/** Map browser path to {@link ROUTE_VISIBILITY} key (supports `:id` segments). */
export function resolveRoutePathFromLocation(pathname: string): string {
    const path = routePathFromLocation(pathname);
    if (path in ROUTE_VISIBILITY) return path;
    const segments = path.split("/");
    let best: string | null = null;
    let bestLiteralMatches = -1;
    for (const pattern of Object.keys(ROUTE_VISIBILITY)) {
        if (!routePatternToRegExp(pattern).test(path)) continue;
        const patternSegs = pattern.split("/");
        let literalMatches = 0;
        for (let i = 0; i < patternSegs.length; i++) {
            const ps = patternSegs[i]!;
            if (!ps.startsWith(":") && segments[i] === ps) literalMatches++;
        }
        if (
            literalMatches > bestLiteralMatches ||
            (literalMatches === bestLiteralMatches && (best == null || pattern.length > best.length))
        ) {
            best = pattern;
            bestLiteralMatches = literalMatches;
        }
    }
    return best ?? path;
}

/** Authorize current URL for role (used by layout outlet guard). */
export function routeLocationAllowed(
    pathname: string,
    role: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return routeChildPathAllowed(resolveRoutePathFromLocation(pathname), role, overrides);
}

export type SettingsSectionId =
    | "practice"
    | "account"
    | "notifications"
    | "security"
    | "license"
    | "integrations"
    | "migration"
    | "appearance"
    | "workflows"
    | "system"
    | "about";

/** Settings sub-panels (page is already gated by `settings` route). */
export const SETTINGS_SECTION_VISIBILITY: Partial<Record<SettingsSectionId, NavVisibility>> = {
    migration: { kind: "action", action: "ops.migration" },
    system: { kind: "anyOf", actions: ["ops.backup", "ops.system", "ops.logs"] },
    /** License activation, subscription portal — practice lead / IT (ops.system). */
    "license": { kind: "action", action: "ops.system" },
    /** Manufacturer interfaces — not for front desk. */
    "integrations": { kind: "action", action: "ops.system" },
    /** Practice master data (invoice, logo) — practice management. Reception: only via Administration/front-desk-relevant areas. */
    "practice": { kind: "action", action: "ops.system" },
    /** Compliance / 2FA policies — practice management; Reception sees device sessions under account. */
    security: { kind: "action", action: "ops.system" },
};

/** Front desk: explicit allowlist — prevents "default = visible" for admin panels. */
export const RECEPTION_SETTINGS_SECTIONS: ReadonlySet<SettingsSectionId> = new Set(
    [
        "account",
        ...(NOTIFICATIONS_SETTINGS_ENABLED ? (["notifications"] as const) : []),
        "appearance",
        "workflows",
        "about",
    ] satisfies readonly SettingsSectionId[],
);

/** Device network admin panel: app RBAC PHYSICIAN + ADMIN seat (seat checked in UI/backend). */
export function canAccessClusterAdminPanel(role: string | undefined): boolean {
    return parseRole(role) === "PHYSICIAN";
}

export function settingsSectionVisible(
    section: string,
    role: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (!NOTIFICATIONS_SETTINGS_ENABLED && section === "notifications") {
        return false;
    }
    if (!INTEGRATIONS_SETTINGS_ENABLED && section === "integrations") {
        return false;
    }
    if (!MIGRATION_SETTINGS_ENABLED && section === "migration") {
        return false;
    }
    if (!routeChildPathAllowed("settings", role, overrides)) return false;
    const parsedRole = parseRole(role);
    if (parsedRole === "RECEPTION") {
        return RECEPTION_SETTINGS_SECTIONS.has(section as SettingsSectionId);
    }
    const vis = SETTINGS_SECTION_VISIBILITY[section as SettingsSectionId];
    if (!vis) return true;
    return navVisibilitySatisfied(vis, parsedRole ?? role, overrides);
}
