/**
 * Native OS "Go to" submenu: same capability gates as routes ({@link ROUTE_VISIBILITY}),
 * grouped like the sidebar plus operations and help entries.
 */

import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "./rbac";
import { DATENSCHUTZ_UI_ENABLED } from "./datenschutz-config";
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";
import {
    LEISTUNGEN_MENU_ENABLED,
    REZEPTE_ATTESTE_MENU_ENABLED,
} from "./catalog-menu-flags";

export type NativeGoMenuPayloadItem = { path: string; label: string };

/** Sentinel sent to Rust to insert a submenu separator. */
export const NATIVE_GO_MENU_SEP = "__sep__";

const PATH_LABEL_KEYS: Record<string, string> = {
    "/": "nav.dashboard",
    "/termine": "nav.termine",
    "/patienten": "nav.patienten",
    "/akten/zu-validieren": "nav.akten_zu_validieren",
    "/tickets": "nav.praxis_tickets",
    "/posteingang": "nav.posteingang",
    "/rezepte": "nav.rezepte",
    "/atteste": "nav.atteste",
    "/statistik": "nav.statistik",
    "/bilanz": "nav.bilanz",
    "/finanzen": "nav.finanzen",
    "/finanzen/kasse": "nav.finanzen_reception",
    "/bestellungen": "nav.bestellungen",
    "/leistungen": "nav.leistungen",
    "/produkte": "nav.produkte",
    "/verwaltung": "nav.verwaltung",
    "/einstellungen": "nav.settings",
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
    ["/patienten", "/akten/zu-validieren", "/posteingang", "/tickets", "/rezepte", "/atteste", "/statistik", "/bilanz"],
    ["/finanzen", "/finanzen/kasse", "/bestellungen", "/leistungen", "/produkte"],
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

/** Menu "File → New …" — same logic as routes (`termin.write`, `finanzen.write`, …). */
export function buildNativeFileNewGate(rolle: string | undefined): NativeFileNewGate {
    return {
        termin: navVisibilitySatisfied({ kind: "action", action: "termin.write" }, rolle),
        patient: navVisibilitySatisfied({ kind: "action", action: "patient.write" }, rolle),
        zahlung: navVisibilitySatisfied({ kind: "action", action: "finanzen.write" }, rolle),
        bestellung: navVisibilitySatisfied({ kind: "action", action: "bestellung.write" }, rolle),
        leistung:
            LEISTUNGEN_MENU_ENABLED
            && navVisibilitySatisfied({ kind: "action", action: "finanzen.write" }, rolle),
        // TODO(deferred-roles): was ["ARZT", "STEUERBERATER"]
        bilanz: navVisibilitySatisfied({ kind: "roles", roles: ["ARZT"] }, rolle),
    };
}

export function buildSyncNativeMenuPayload(rolle: string | undefined, t: (key: string) => string): SyncNativeMenuPayload {
    return {
        goItems: buildNativeGoMenuItems(rolle, t),
        fileNew: buildNativeFileNewGate(rolle),
        helpShowDatenschutz:
            DATENSCHUTZ_UI_ENABLED
            && navVisibilitySatisfied(ROUTE_VISIBILITY.datenschutz, rolle),
        viewShowCalendar: navVisibilitySatisfied({ kind: "action", action: "termin.read" }, rolle),
    };
}

/**
 * Builds "Go to" rows for {@link buildSyncNativeMenuPayload}. Labels via `t()` / locale.
 */
export function buildNativeGoMenuItems(rolle: string | undefined, t: (key: string) => string): NativeGoMenuPayloadItem[] {
    const out: NativeGoMenuPayloadItem[] = [];
    for (const group of NATIVE_GO_GROUPS) {
        const slice: NativeGoMenuPayloadItem[] = [];
        for (const path of group) {
            if (!POSTEINGANG_UI_ENABLED && path === "/posteingang") continue;
            if (!DATENSCHUTZ_UI_ENABLED && path === "/datenschutz") continue;
            if (!REZEPTE_ATTESTE_MENU_ENABLED && (path === "/rezepte" || path === "/atteste")) continue;
            if (!LEISTUNGEN_MENU_ENABLED && path === "/leistungen") continue;
            if (path === "/produkte") continue;
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
