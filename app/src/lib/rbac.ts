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
        /** List Behandlung/Untersuchung rows for payment booking — mirrors Rust `patient.behandlungen_list_for_zahlung`. */
        case "patient.behandlungen_list_for_zahlung":
            return role === "ARZT" || role === "REZEPTION" || role === "STEUERBERATER";
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
        /** Mirrors Rust `bestellung.read` (any authenticated role). */
        case "bestellung.read":
            return true;
        /** Mirrors Rust `bestellung.write` — not Steuerberater. */
        case "bestellung.write":
            return role === "ARZT" || role === "REZEPTION" || role === "PHARMABERATER";
        case "dashboard.read":
            return true;
        case "produkt.read":
            return true;
        case "produkt.write":
            return role === "ARZT" || role === "REZEPTION" || role === "PHARMABERATER";
        case "personal.read":
        case "personal.write":
            return role === "ARZT";
        /** Rezept-/Attest-Stammdaten-Vorlagen (Dokumentvorlagen) — wie Personal nur Praxisinhaber:in. */
        case "vorlagen.read":
        case "vorlagen.write":
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
    return navVisibilitySatisfied(item.visibility, rolle);
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
    { to: "/bestellungen", labelKey: "nav.bestellungen", icon: "🚚", visibility: { kind: "action", action: "finanzen.read" } },
    { to: "/leistungen", labelKey: "nav.leistungen", icon: "🦷", visibility: { kind: "action", action: "finanzen.read" } },
    /* `produkt.read` allows every role in Rust; sidebar matches product scope (exclude Steuerberater). */
    { to: "/produkte", labelKey: "nav.produkte", icon: "📦", visibility: { kind: "roles", roles: ["ARZT", "REZEPTION", "PHARMABERATER"] } },
    { to: "/verwaltung", labelKey: "nav.verwaltung", icon: "🏢", visibility: { kind: "action", action: "personal.read" } },
    { to: "/statistik", labelKey: "nav.statistik", icon: "📈", visibility: { kind: "roles", roles: ["ARZT", "STEUERBERATER"] } },
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
export const ROUTE_VISIBILITY: Record<string, NavVisibility> = {
    "": { kind: "action", action: "dashboard.read" },
    termine: { kind: "action", action: "termin.read" },
    "termine/neu": { kind: "action", action: "termin.write" },
    patienten: { kind: "action", action: "patient.read" },
    "patienten/neu": { kind: "action", action: "patient.write" },
    "patienten/:id": { kind: "action", action: "patient.read" },
    "patienten/:id/rezept/neu": { kind: "action", action: "patient.write_medical" },
    "patienten/:id/rezept/:rezeptId": { kind: "action", action: "patient.write_medical" },
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
    verwaltung: { kind: "action", action: "personal.read" },
    "verwaltung/team": { kind: "action", action: "personal.read" },
    "verwaltung/arbeitstage": { kind: "action", action: "personal.read" },
    "verwaltung/praxisplanung": { kind: "action", action: "personal.read" },
    "verwaltung/arbeitszeiten": { kind: "action", action: "personal.read" },
    "verwaltung/sonder-sperrzeiten": { kind: "action", action: "personal.read" },
    "verwaltung/praxis-praeferenzen": { kind: "action", action: "personal.read" },
    "verwaltung/vorlagen": { kind: "action", action: "vorlagen.read" },
    "verwaltung/vorlagen/editor": { kind: "action", action: "vorlagen.read" },
    "verwaltung/behandlungs-katalog": { kind: "action", action: "personal.read" },
    /** Bestellwesen (nicht `finanzen.*`) — spiegelt Tauri `bestellung.read` / `bestellung.write` für Praxis-Stammdaten. */
    "verwaltung/bestellstamm": { kind: "action", action: "bestellung.read" },
    "verwaltung/finanzen-werkzeuge": { kind: "action", action: "personal.read" },
    "verwaltung/tagesabschluss": { kind: "action", action: "personal.read" },
    "verwaltung/finanzen-berichte": { kind: "action", action: "personal.read" },
    "verwaltung/finanzen-berichte/tagesabschluss": { kind: "action", action: "personal.read" },
    "verwaltung/finanzen-berichte/rechnung": { kind: "action", action: "personal.read" },
    "verwaltung/lager-und-bestellwesen": { kind: "action", action: "personal.read" },
    "verwaltung/vertraege": { kind: "action", action: "personal.read" },
    "verwaltung/leistungen-kataloge-vorlagen": { kind: "action", action: "personal.read" },
};

export function navVisibilitySatisfied(visibility: NavVisibility, rolle: string | undefined): boolean {
    const role = parseRole(rolle);
    if (!role) return false;
    if (visibility.kind === "action") return allowed(visibility.action, role);
    if (visibility.kind === "allOf") return visibility.actions.every((a) => allowed(a, role));
    if (visibility.kind === "anyOf") return visibility.actions.some((a) => allowed(a, role));
    return visibility.roles.includes(role);
}

export function routeChildPathAllowed(routePath: string, rolle: string | undefined): boolean {
    const visibility = ROUTE_VISIBILITY[routePath];
    if (!visibility) return false;
    return navVisibilitySatisfied(visibility, rolle);
}
