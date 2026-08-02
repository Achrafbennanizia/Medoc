/**
 * Client-side RBAC for navigation and UI gating.
 * Matrix: `config/rbac.yaml` → `rbac.generated.ts` (run `cargo build` to refresh).
 */

import { baseAllowedGenerated, RBAC_ALL_ACTIONS } from "./rbac.generated";
import { DATENSCHUTZ_UI_ENABLED } from "./datenschutz-config";
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";
import {
    LEISTUNGEN_MENU_ENABLED,
    PRODUKTE_MENU_ENABLED,
    REZEPTE_ATTESTE_MENU_ENABLED,
} from "./catalog-menu-flags";
import {
    BENACHRICHTIGUNGEN_SETTINGS_ENABLED,
    INTEGRATIONEN_SETTINGS_ENABLED,
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

/** Finanzen read access: full overview or cash area (Rezeption). */
export const FINANZEN_READ_OR_RECEPTION = ["finanzen.read", "finanzen.reception.view"] as const;

export function canReadFinanzen(
    role: Role,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return FINANZEN_READ_OR_RECEPTION.some((action) => allowed(action, role, overrides));
}

/** MVP active login roles. TODO(deferred-roles): restore STEUERBERATER | PHARMABERATER. */
export type Role = ActiveRoleWire;
// export type Role = "ARZT" | "REZEPTION" | "STEUERBERATER" | "PHARMABERATER";

export function parseRole(s: string | undefined): Role | null {
    if (isDeferredRoleWire(s)) return null;
    if (s === "ARZT" || s === "REZEPTION") {
        return s;
    }
    // TODO(deferred-roles): || s === "STEUERBERATER" || s === "PHARMABERATER"
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
    rolle: string | undefined,
    item: NavItemDefinition,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return navVisibilitySatisfied(item.visibility, rolle, overrides);
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
    { to: "/termine", labelKey: "nav.termine", visibility: { kind: "action", action: "termin.read" } },
    { to: "/patienten", labelKey: "nav.patienten", visibility: { kind: "action", action: "patient.read" } },
    { to: "/akten/zu-validieren", labelKey: "nav.akten_zu_validieren", visibility: { kind: "action", action: "patient.read_medical" } },
    ...(POSTEINGANG_UI_ENABLED
        ? [{ to: "/posteingang", labelKey: "nav.posteingang", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION"] } } as NavItemDefinition]
        : []),
    { to: "/tickets", labelKey: "nav.praxis_tickets", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION"] } },
    ...(REZEPTE_ATTESTE_MENU_ENABLED
        ? [{ to: "/rezepte", labelKey: "nav.rezepte", visibility: { kind: "action", action: "patient.read_medical" } } as NavItemDefinition]
        : []),
    { to: "/finanzen", labelKey: "nav.finanzen", visibility: { kind: "action", action: "finanzen.read" } },
    {
        to: "/finanzen/kasse",
        labelKey: "nav.finanzen_reception",
        visibility: { kind: "action", action: "finanzen.reception.view" },
    },
    { to: "/bestellungen", labelKey: "nav.bestellungen", visibility: { kind: "action", action: "bestellung.read" } },
    ...(LEISTUNGEN_MENU_ENABLED
        ? [{ to: "/leistungen", labelKey: "nav.leistungen", visibility: { kind: "anyOf", actions: FINANZEN_READ_OR_RECEPTION } } as NavItemDefinition]
        : []),
    { to: "/verwaltung", labelKey: "nav.verwaltung", visibility: { kind: "action", action: "verwaltung.read" } },
    {
        to: "/personal/arbeitszeit",
        labelKey: "nav.arbeitszeit",
        visibility: { kind: "action", action: "work_time.self" },
    },
    // TODO(deferred-roles): { to: "/statistik", visibility: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] } },
    { to: "/statistik", labelKey: "nav.statistik", visibility: { kind: "roles", roles: ["ARZT"] } },
    {
        to: "/einstellungen",
        labelKey: "nav.settings",
        visibility: { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    },
];

/**
 * Maps React Router child `path` (the `path` prop under the layout route) to a sidebar `to`
 * used in {@link NAV_ITEM_DEFINITIONS}. Patient detail shares visibility with `/patienten`.
 */
export const ROUTE_VISIBILITY: Record<string, NavVisibility> = {
    "": { kind: "action", action: "dashboard.read" },
    termine: { kind: "action", action: "termin.read" },
    "termine/neu": { kind: "action", action: "termin.write" },
    patienten: { kind: "action", action: "patient.read" },
    "patienten/neu": { kind: "action", action: "patient.write" },
    "patienten/:id": { kind: "action", action: "patient.read" },
    "patienten/:id/rezept/neu": { kind: "action", action: "patient.write_medical" },
    "patienten/:id/rezept/:rezeptId": { kind: "action", action: "patient.write_medical" },
    "akten/zu-validieren": { kind: "action", action: "patient.read_medical" },
    posteingang: { kind: "roles", roles: ["ARZT", "REZEPTION"] },
    tickets: { kind: "roles", roles: ["ARZT", "REZEPTION"] },
    "tickets/neu": { kind: "action", action: "verwaltung.read" },
    "tickets/:id/bearbeiten": { kind: "action", action: "verwaltung.read" },
    finanzen: { kind: "action", action: "finanzen.read" },
    "finanzen/kasse": { kind: "action", action: "finanzen.reception.view" },
    "finanzen/kasse/neu": { kind: "action", action: "finanzen.write" },
    "finanzen/neu": { kind: "action", action: "finanzen.write" },
    bestellungen: { kind: "action", action: "bestellung.read" },
    "bestellungen/neu": { kind: "action", action: "bestellung.write" },
    "bestellungen/:id": { kind: "action", action: "bestellung.read" },
    // TODO(deferred-roles): bilanz — was ["ARZT", "STEUERBERATER"]
    bilanz: { kind: "roles", roles: ["ARZT"] },
    "bilanz/neu": { kind: "roles", roles: ["ARZT"] },
    rezepte: { kind: "action", action: "patient.read_medical" },
    atteste: { kind: "action", action: "patient.read_medical" },
    leistungen: { kind: "anyOf", actions: FINANZEN_READ_OR_RECEPTION },
    "leistungen/neu": { kind: "action", action: "finanzen.write" },
    produkte: { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    personal: { kind: "action", action: "personal.read" },
    "personal/arbeitsplan": { kind: "action", action: "personal.read" },
    "personal/arbeitszeit": { kind: "action", action: "work_time.self" },
    "verwaltung/team/arbeitszeit": { kind: "action", action: "work_time.team.read" },
    "personal/neu": { kind: "action", action: "personal.write" },
    statistik: { kind: "action", action: "statistik.read" },
    audit: { kind: "action", action: "audit.read" },
    datenschutz: { kind: "allOf", actions: ["patient.read", "ops.dsgvo"] },
    einstellungen: { kind: "roles", roles: [...ACTIVE_ROLE_WIRES] },
    logs: { kind: "action", action: "ops.logs" },
    ops: { kind: "action", action: "ops.backup" },
    compliance: { kind: "anyOf", actions: ["ops.dsgvo", "ops.system"] },
    hilfe: { kind: "action", action: "dashboard.read" },
    feedback: { kind: "action", action: "dashboard.read" },
    migration: { kind: "action", action: "ops.migration" },
    verwaltung: { kind: "action", action: "verwaltung.read" },
    "verwaltung/aufgaben": { kind: "action", action: "verwaltung.read" },
    "verwaltung/team": { kind: "action", action: "verwaltung.team.read" },
    "verwaltung/krankenbescheinigung": { kind: "action", action: "verwaltung.team.read" },
    "verwaltung/arbeitstage": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/praxisplanung": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/arbeitszeiten": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/sonder-sperrzeiten": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/praxis-praeferenzen": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/vorlagen": { kind: "action", action: "verwaltung.vorlagen.read" },
    "verwaltung/vorlagen/editor": { kind: "action", action: "verwaltung.vorlagen.write" },
    "verwaltung/behandlungs-katalog": { kind: "action", action: "patient.read_medical" },
    /** Order management (not `finanzen.*`) — mirrors Tauri `bestellung.read` / `bestellung.write` for practice master data. */
    "verwaltung/bestellstamm": { kind: "action", action: "bestellung.read" },
    "verwaltung/finanzen-werkzeuge": { kind: "action", action: "finanzen.read" },
    "verwaltung/tagesabschluss": { kind: "action", action: "finanzen.tagesabschluss.write" },
    "verwaltung/finanzen-berichte": { kind: "action", action: "finanzen.read" },
    "verwaltung/finanzen-berichte/tagesabschluss": { kind: "action", action: "finanzen.tagesabschluss.write" },
    "verwaltung/finanzen-berichte/rechnung": { kind: "action", action: "finanzen.read" },
    "verwaltung/lager-und-bestellwesen": { kind: "action", action: "verwaltung.lager.read" },
    "verwaltung/vertraege": { kind: "action", action: "verwaltung.vertraege.read" },
    "verwaltung/leistungen-kataloge-vorlagen": {
        kind: "anyOf",
        actions: ["verwaltung.kataloge.read", "verwaltung.vorlagen.read"],
    },
};

export function navVisibilitySatisfied(
    visibility: NavVisibility,
    rolle: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (isDeferredRoleWire(rolle)) return false;
    const role = parseRole(rolle);
    if (!role) return false;
    if (visibility.kind === "action") return allowed(visibility.action, role, overrides);
    if (visibility.kind === "allOf") {
        return visibility.actions.every((a) => allowed(a, role, overrides));
    }
    if (visibility.kind === "anyOf") {
        return visibility.actions.some((a) => allowed(a, role, overrides));
    }
    return visibility.roles.includes(role);
}

export function routeChildPathAllowed(
    routePath: string,
    rolle: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (!POSTEINGANG_UI_ENABLED && routePath === "posteingang") {
        return false;
    }
    if (!DATENSCHUTZ_UI_ENABLED && routePath === "datenschutz") {
        return false;
    }
    if (!REZEPTE_ATTESTE_MENU_ENABLED && (routePath === "rezepte" || routePath === "atteste" || routePath.startsWith("verwaltung/vorlagen"))) {
        return false;
    }
    if (!LEISTUNGEN_MENU_ENABLED && (routePath === "leistungen" || routePath.startsWith("leistungen/"))) {
        return false;
    }
    if (!PRODUKTE_MENU_ENABLED && routePath === "produkte") {
        return false;
    }
    const role = parseRole(rolle);
    if (role === "REZEPTION" && routePath.startsWith("verwaltung")) {
        return false;
    }
    const visibility = ROUTE_VISIBILITY[routePath];
    if (!visibility) return false;
    return navVisibilitySatisfied(visibility, rolle, overrides);
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
    rolle: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    return routeChildPathAllowed(resolveRoutePathFromLocation(pathname), rolle, overrides);
}

export type SettingsSectionId =
    | "praxis"
    | "konto"
    | "benachrichtigungen"
    | "sicherheit"
    | "lizenz"
    | "integrationen"
    | "migration"
    | "darstellung"
    | "arbeitsablaeufe"
    | "system"
    | "ueber";

/** Settings sub-panels (page is already gated by `einstellungen` route). */
export const SETTINGS_SECTION_VISIBILITY: Partial<Record<SettingsSectionId, NavVisibility>> = {
    migration: { kind: "action", action: "ops.migration" },
    system: { kind: "anyOf", actions: ["ops.backup", "ops.system", "ops.logs"] },
    /** License activation, subscription portal — practice lead / IT (ops.system). */
    lizenz: { kind: "action", action: "ops.system" },
    /** Manufacturer interfaces — not for front desk. */
    integrationen: { kind: "action", action: "ops.system" },
    /** Practice master data (invoice, logo) — practice management. Rezeption: only via Verwaltung/front-desk-relevant areas. */
    praxis: { kind: "action", action: "ops.system" },
    /** Compliance / 2FA policies — practice management; Rezeption sees device sessions under account. */
    sicherheit: { kind: "action", action: "ops.system" },
};

/** Front desk: explicit allowlist — prevents "default = visible" for admin panels. */
export const REZEPTION_SETTINGS_SECTIONS: ReadonlySet<SettingsSectionId> = new Set(
    [
        "konto",
        ...(BENACHRICHTIGUNGEN_SETTINGS_ENABLED ? (["benachrichtigungen"] as const) : []),
        "darstellung",
        "arbeitsablaeufe",
        "ueber",
    ] satisfies readonly SettingsSectionId[],
);

/** Device network admin panel: app RBAC ARZT + ADMIN seat (seat checked in UI/backend). */
export function canAccessVerbundAdminPanel(rolle: string | undefined): boolean {
    return parseRole(rolle) === "ARZT";
}

export function settingsSectionVisible(
    section: string,
    rolle: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (!BENACHRICHTIGUNGEN_SETTINGS_ENABLED && section === "benachrichtigungen") {
        return false;
    }
    if (!INTEGRATIONEN_SETTINGS_ENABLED && section === "integrationen") {
        return false;
    }
    if (!MIGRATION_SETTINGS_ENABLED && section === "migration") {
        return false;
    }
    if (!routeChildPathAllowed("einstellungen", rolle, overrides)) return false;
    const role = parseRole(rolle);
    if (role === "REZEPTION") {
        return REZEPTION_SETTINGS_SECTIONS.has(section as SettingsSectionId);
    }
    const vis = SETTINGS_SECTION_VISIBILITY[section as SettingsSectionId];
    if (!vis) return true;
    return navVisibilitySatisfied(vis, rolle, overrides);
}
