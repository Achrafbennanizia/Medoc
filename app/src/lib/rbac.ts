/**
 * Client-side RBAC for navigation and UI gating.
 * Must stay aligned with `app/src-tauri/src/application/rbac.rs` (`allowed` matrix).
 */

export type Role = "ARZT" | "REZEPTION" | "STEUERBERATER" | "PHARMABERATER";

export function parseRole(s: string | undefined): Role | null {
    if (s === "ARZT" || s === "REZEPTION" || s === "STEUERBERATER" || s === "PHARMABERATER") {
        return s;
    }
    return null;
}

/** Mirrors `application::rbac::allowed` in Rust (keep lists identical). */
export function allowed(action: string, role: Role): boolean {
    switch (action) {
        case "patient.read_medical":
        case "patient.write_medical":
            return role === "ARZT";
        case "patient.read":
        case "patient.write":
            return role === "ARZT" || role === "REZEPTION";
        case "termin.read":
        case "termin.write":
        case "termin.list_aerzte":
            return role === "ARZT" || role === "REZEPTION";
        case "finanzen.read":
            return role === "ARZT" || role === "REZEPTION" || role === "STEUERBERATER";
        case "finanzen.write":
            return role === "ARZT" || role === "REZEPTION" || role === "STEUERBERATER";
        case "dashboard.read":
            return true;
        case "produkt.read":
            return true;
        case "produkt.write":
            return role === "ARZT" || role === "REZEPTION" || role === "PHARMABERATER";
        case "personal.read":
        case "personal.write":
            return role === "ARZT";
        case "audit.read":
            return role === "ARZT";
        case "ops.backup":
        case "ops.dsgvo":
        case "ops.migration":
        case "ops.system":
        case "ops.logs":
            return role === "ARZT";
        default:
            return false;
    }
}

export type NavVisibility =
    | { kind: "action"; action: string }
    | { kind: "allOf"; actions: readonly string[] }
    | { kind: "anyOf"; actions: readonly string[] }
    | { kind: "roles"; roles: readonly Role[] };

export type NavItemDefinition = {
    to: string;
    labelKey: string;
    icon: string;
    visibility: NavVisibility;
};

export function navItemVisible(rolle: string | undefined, item: NavItemDefinition): boolean {
    const role = parseRole(rolle);
    if (!role) return false;
    const v = item.visibility;
    if (v.kind === "action") return allowed(v.action, role);
    if (v.kind === "allOf") return v.actions.every((a) => allowed(a, role));
    if (v.kind === "anyOf") return v.actions.some((a) => allowed(a, role));
    return v.roles.includes(role);
}

/**
 * Sidebar navigation: each entry is gated by the same capability checks the backend uses,
 * except where no single Tauri permission exists yet (see inline comments).
 */
export const NAV_ITEM_DEFINITIONS: NavItemDefinition[] = [
    {
        to: "/",
        labelKey: "nav.dashboard",
        icon: "📊",
        visibility: { kind: "action", action: "dashboard.read" },
    },
    { to: "/termine", labelKey: "nav.termine", icon: "📅", visibility: { kind: "action", action: "termin.read" } },
    { to: "/patienten", labelKey: "nav.patienten", icon: "👥", visibility: { kind: "action", action: "patient.read" } },
    { to: "/finanzen", labelKey: "nav.finanzen", icon: "💰", visibility: { kind: "action", action: "finanzen.read" } },
    /* Bilanz: narrower than `finanzen.read` — reporting view for ARZT/STEUERBERATER only */
    { to: "/bilanz", labelKey: "nav.bilanz", icon: "📊", visibility: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] } },
    { to: "/rezepte", labelKey: "nav.rezepte", icon: "💊", visibility: { kind: "action", action: "patient.read_medical" } },
    { to: "/atteste", labelKey: "nav.atteste", icon: "📄", visibility: { kind: "action", action: "patient.read_medical" } },
    { to: "/leistungen", labelKey: "nav.leistungen", icon: "🦷", visibility: { kind: "action", action: "finanzen.read" } },
    /* `produkt.read` allows every role in Rust; sidebar matches product scope (exclude Steuerberater). */
    { to: "/produkte", labelKey: "nav.produkte", icon: "📦", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION", "PHARMABERATER"] } },
    { to: "/personal", labelKey: "nav.personal", icon: "👤", visibility: { kind: "action", action: "personal.read" } },
    { to: "/statistik", labelKey: "nav.statistik", icon: "📈", visibility: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] } },
    { to: "/audit", labelKey: "nav.audit", icon: "📋", visibility: { kind: "action", action: "audit.read" } },
    { to: "/logs", labelKey: "nav.logs", icon: "📜", visibility: { kind: "action", action: "ops.logs" } },
    { to: "/ops", labelKey: "nav.ops", icon: "⚙️", visibility: { kind: "action", action: "ops.backup" } },
    {
        to: "/compliance",
        labelKey: "nav.compliance",
        icon: "🛡️",
        visibility: { kind: "anyOf", actions: ["ops.dsgvo", "ops.system"] },
    },
    {
        to: "/datenschutz",
        labelKey: "nav.datenschutz",
        icon: "🔒",
        visibility: { kind: "allOf", actions: ["patient.read", "ops.dsgvo"] },
    },
    {
        to: "/einstellungen",
        labelKey: "nav.einstellungen",
        icon: "⚙️",
        visibility: { kind: "roles", roles: ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] },
    },
];

/**
 * Maps React Router child `path` (the `path` prop under the layout route) to a sidebar `to`
 * used in {@link NAV_ITEM_DEFINITIONS}. Patient detail shares visibility with `/patienten`.
 */
export const ROUTE_PATH_TO_NAV_TO: Record<string, string> = {
    "": "/",
    termine: "/termine",
    patienten: "/patienten",
    "patienten/:id": "/patienten",
    finanzen: "/finanzen",
    bilanz: "/bilanz",
    rezepte: "/rezepte",
    atteste: "/atteste",
    leistungen: "/leistungen",
    produkte: "/produkte",
    personal: "/personal",
    statistik: "/statistik",
    audit: "/audit",
    datenschutz: "/datenschutz",
    einstellungen: "/einstellungen",
    logs: "/logs",
    ops: "/ops",
    compliance: "/compliance",
};

export function routeChildPathAllowed(routePath: string, rolle: string | undefined): boolean {
    const navTo = ROUTE_PATH_TO_NAV_TO[routePath];
    if (!navTo) return false;
    const def = NAV_ITEM_DEFINITIONS.find((d) => d.to === navTo);
    if (!def) return false;
    return navItemVisible(rolle, def);
}
