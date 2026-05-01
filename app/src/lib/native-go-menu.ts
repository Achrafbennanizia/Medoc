/**
 * Native OS „Gehe zu“ submenu: same capability gates as routes ({@link ROUTE_VISIBILITY}),
 * grouped like the sidebar plus Betrieb- und Hilfe-Einträge.
 */

import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "./rbac";

export type NativeGoMenuPayloadItem = { path: string; label: string };

/** Sentinel sent to Rust to insert a submenu separator. */
export const NATIVE_GO_MENU_SEP = "__sep__";

const PATH_LABEL_KEYS: Record<string, string> = {
    "/": "nav.dashboard",
    "/termine": "nav.termine",
    "/patienten": "nav.patienten",
    "/rezepte": "nav.rezepte",
    "/atteste": "nav.atteste",
    "/statistik": "nav.statistik",
    "/bilanz": "nav.bilanz",
    "/finanzen": "nav.finanzen",
    "/bestellungen": "nav.bestellungen",
    "/leistungen": "nav.leistungen",
    "/produkte": "nav.produkte",
    "/verwaltung": "nav.verwaltung",
    "/einstellungen": "nav.einstellungen",
    "/audit": "nav.audit",
    "/ops": "nav.ops",
    "/logs": "nav.logs",
    "/compliance": "nav.compliance",
    "/datenschutz": "nav.datenschutz",
    "/migration": "nav.migration",
    "/hilfe": "nav.hilfe",
    "/feedback": "nav.feedback",
};

/** Route groups: separators between groups; within a group, order matches sidebar-style UX. */
const NATIVE_GO_GROUPS: readonly (readonly string[])[] = [
    ["/", "/termine"],
    ["/patienten", "/rezepte", "/atteste", "/statistik", "/bilanz"],
    ["/finanzen", "/bestellungen", "/leistungen", "/produkte"],
    ["/verwaltung"],
    ["/einstellungen"],
    ["/audit", "/ops", "/logs", "/compliance", "/datenschutz", "/migration"],
    ["/hilfe", "/feedback"],
];

export function visibilityForNativeGoPath(path: string): NavVisibility {
    if (path === "/") return ROUTE_VISIBILITY[""];
    const key = path.startsWith("/") ? path.slice(1) : path;
    const v = ROUTE_VISIBILITY[key];
    if (!v) throw new Error(`native-go-menu: missing ROUTE_VISIBILITY for path "${path}"`);
    return v;
}

/** SessionStorage: calendar toolbar action deferred until `/termine` is mounted. */
export const MEDOC_PENDING_TERMIN_MENU_KEY = "medoc-pending-termin-menu-v1";

export type NativeFileNewGate = {
    termin: boolean;
    patient: boolean;
    zahlung: boolean;
    bestellung: boolean;
    leistung: boolean;
    bilanz: boolean;
};

export type SyncNativeMenuPayload = {
    goItems: NativeGoMenuPayloadItem[];
    fileNew: NativeFileNewGate;
    helpShowDatenschutz: boolean;
    viewShowCalendar: boolean;
};

/** Menü „Datei → Neu …“ — gleiche Logik wie Routen (`termin.write`, `finanzen.write`, …). */
export function buildNativeFileNewGate(rolle: string | undefined): NativeFileNewGate {
    return {
        termin: navVisibilitySatisfied({ kind: "action", action: "termin.write" }, rolle),
        patient: navVisibilitySatisfied({ kind: "action", action: "patient.write" }, rolle),
        zahlung: navVisibilitySatisfied({ kind: "action", action: "finanzen.write" }, rolle),
        bestellung: navVisibilitySatisfied({ kind: "action", action: "finanzen.write" }, rolle),
        leistung: navVisibilitySatisfied({ kind: "action", action: "finanzen.write" }, rolle),
        bilanz: navVisibilitySatisfied({ kind: "roles", roles: ["ARZT", "STEUERBERATER"] }, rolle),
    };
}

export function buildSyncNativeMenuPayload(rolle: string | undefined, t: (key: string) => string): SyncNativeMenuPayload {
    return {
        goItems: buildNativeGoMenuItems(rolle, t),
        fileNew: buildNativeFileNewGate(rolle),
        helpShowDatenschutz: navVisibilitySatisfied(ROUTE_VISIBILITY.datenschutz, rolle),
        viewShowCalendar: navVisibilitySatisfied({ kind: "action", action: "termin.read" }, rolle),
    };
}

/**
 * Builds „Gehe zu“ rows for {@link buildSyncNativeMenuPayload}. Labels via `t()` / locale.
 */
export function buildNativeGoMenuItems(rolle: string | undefined, t: (key: string) => string): NativeGoMenuPayloadItem[] {
    const out: NativeGoMenuPayloadItem[] = [];
    for (const group of NATIVE_GO_GROUPS) {
        const slice: NativeGoMenuPayloadItem[] = [];
        for (const path of group) {
            if (!navVisibilitySatisfied(visibilityForNativeGoPath(path), rolle)) continue;
            const labelKey = PATH_LABEL_KEYS[path];
            if (!labelKey) throw new Error(`native-go-menu: missing label key for "${path}"`);
            slice.push({ path, label: t(labelKey) });
        }
        if (slice.length === 0) continue;
        if (out.length > 0) out.push({ path: NATIVE_GO_MENU_SEP, label: "" });
        out.push(...slice);
    }
    return out;
}
