/**
 * Client-side RBAC for navigation and UI gating.
 * Matrix: `config/rbac.yaml` → `rbac.generated.ts` (run `cargo build` to refresh).
 */

import { baseAllowedGenerated } from "./rbac.generated";
import type { PermissionOverride } from "../models/types";

export type { PermissionOverride };

export type Role = "ARZT" | "REZEPTION" | "STEUERBERATER" | "PHARMABERATER";

export function parseRole(s: string | undefined): Role | null {
    if (s === "ARZT" || s === "REZEPTION" || s === "STEUERBERATER" || s === "PHARMABERATER") {
        return s;
    }
    return null;
}

/** Rollenmatrix ohne Overrides — generated from `config/rbac.yaml`. */
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
    /* Posteingang deaktiviert — Aufgaben unter Verwaltung
    { to: "/posteingang", labelKey: "nav.posteingang", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION"] } },
    */
    { to: "/tickets", labelKey: "nav.praxis_tickets", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION"] } },
    { to: "/finanzen", labelKey: "nav.finanzen", visibility: { kind: "action", action: "finanzen.read" } },
    { to: "/bestellungen", labelKey: "nav.bestellungen", visibility: { kind: "action", action: "finanzen.read" } },
    { to: "/leistungen", labelKey: "nav.leistungen", visibility: { kind: "action", action: "finanzen.read" } },
    /* `produkt.read` allows every role in Rust; sidebar matches product scope (exclude Steuerberater). */
    { to: "/produkte", labelKey: "nav.produkte", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION", "PHARMABERATER"] } },
    { to: "/verwaltung", labelKey: "nav.verwaltung", visibility: { kind: "action", action: "verwaltung.read" } },
    { to: "/statistik", labelKey: "nav.statistik", visibility: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] } },
    {
        to: "/einstellungen",
        labelKey: "nav.einstellungen",
        visibility: { kind: "roles", roles: ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] },
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
    /* posteingang deaktiviert
    posteingang: { kind: "roles", roles: ["ARZT", "REZEPTION"] },
    */
    tickets: { kind: "roles", roles: ["ARZT", "REZEPTION"] },
    finanzen: { kind: "action", action: "finanzen.read" },
    "finanzen/neu": { kind: "action", action: "finanzen.write" },
    bestellungen: { kind: "action", action: "finanzen.read" },
    "bestellungen/neu": { kind: "action", action: "finanzen.write" },
    "bestellungen/:id": { kind: "action", action: "finanzen.read" },
    bilanz: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] },
    "bilanz/neu": { kind: "roles", roles: ["ARZT", "STEUERBERATER"] },
    rezepte: { kind: "action", action: "patient.read_medical" },
    atteste: { kind: "action", action: "patient.read_medical" },
    leistungen: { kind: "action", action: "finanzen.read" },
    "leistungen/neu": { kind: "action", action: "finanzen.write" },
    produkte: { kind: "roles", roles: ["ARZT", "REZEPTION", "PHARMABERATER"] },
    personal: { kind: "action", action: "personal.read" },
    "personal/arbeitsplan": { kind: "action", action: "personal.read" },
    "personal/neu": { kind: "action", action: "personal.write" },
    statistik: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] },
    audit: { kind: "action", action: "audit.read" },
    datenschutz: { kind: "allOf", actions: ["patient.read", "ops.dsgvo"] },
    einstellungen: { kind: "roles", roles: ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] },
    logs: { kind: "action", action: "ops.logs" },
    ops: { kind: "action", action: "ops.backup" },
    compliance: { kind: "anyOf", actions: ["ops.dsgvo", "ops.system"] },
    hilfe: { kind: "action", action: "dashboard.read" },
    feedback: { kind: "action", action: "dashboard.read" },
    migration: { kind: "action", action: "ops.migration" },
    verwaltung: { kind: "action", action: "verwaltung.read" },
    "verwaltung/aufgaben": { kind: "action", action: "verwaltung.read" },
    "verwaltung/team": { kind: "action", action: "verwaltung.team.read" },
    "verwaltung/arbeitstage": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/praxisplanung": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/arbeitszeiten": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/sonder-sperrzeiten": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/praxis-praeferenzen": { kind: "action", action: "verwaltung.praxisplanung.read" },
    "verwaltung/vorlagen": { kind: "action", action: "verwaltung.vorlagen.read" },
    "verwaltung/vorlagen/editor": { kind: "action", action: "verwaltung.vorlagen.write" },
    "verwaltung/behandlungs-katalog": { kind: "action", action: "verwaltung.kataloge.read" },
    /** Bestellwesen (nicht `finanzen.*`) — spiegelt Tauri `bestellung.read` / `bestellung.write` für Praxis-Stammdaten. */
    "verwaltung/bestellstamm": { kind: "action", action: "bestellung.read" },
    "verwaltung/finanzen-werkzeuge": { kind: "action", action: "finanzen.read" },
    "verwaltung/tagesabschluss": { kind: "action", action: "finanzen.read" },
    "verwaltung/finanzen-berichte": { kind: "action", action: "finanzen.read" },
    "verwaltung/finanzen-berichte/tagesabschluss": { kind: "action", action: "finanzen.read" },
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

/** Einstellungen sub-panels (page is already gated by `einstellungen` route). */
export const SETTINGS_SECTION_VISIBILITY: Partial<Record<SettingsSectionId, NavVisibility>> = {
    migration: { kind: "action", action: "ops.migration" },
    system: { kind: "anyOf", actions: ["ops.backup", "ops.system", "ops.logs"] },
};

export function settingsSectionVisible(
    section: string,
    rolle: string | undefined,
    overrides?: readonly PermissionOverride[] | null,
): boolean {
    if (!routeChildPathAllowed("einstellungen", rolle, overrides)) return false;
    const vis = SETTINGS_SECTION_VISIBILITY[section as SettingsSectionId];
    if (!vis) return true;
    return navVisibilitySatisfied(vis, rolle, overrides);
}
