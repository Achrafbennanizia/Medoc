/**
 * Native OS "Go to" submenu: same capability gates as routes ({@link ROUTE_VISIBILITY}),
 * grouped like the sidebar plus operations and help entries.
 */

import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "./rbac";
import { PRIVACY_UI_ENABLED } from "./privacy-config";
import { INBOX_UI_ENABLED } from "./inbox-config";
import {
    SERVICES_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "./catalog-menu-flags";

export type NativeGoMenuPayloadItem = { path: string; label: string };

/** Sentinel sent to Rust to insert a submenu separator. */
export const NATIVE_GO_MENU_SEP = "__sep__";

const PATH_LABEL_KEYS: Record<string, string> = {
    "/": "nav.dashboard",
    "/appointments": "nav.appointments",
    "/patients": "nav.patients",
    "/charts/to-validate": "nav.charts_to_validate",
    "/tickets": "nav.practice_tickets",
    "/inbox": "nav.inbox",
    "/prescriptions": "nav.prescriptions",
    "/certificates": "nav.certificates",
    "/statistics": "nav.statistics",
    "/balance-sheet": "nav.balance-sheet",
    "/finance": "nav.finance",
    "/finance/cash": "nav.finance_reception",
    "/purchase-orders": "nav.purchase-orders",
    "/services": "nav.services",
    "/products": "nav.products",
    "/administration": "nav.administration",
    "/settings": "nav.settings",
    "/audit": "nav.audit",
    "/ops": "nav.ops",
    "/logs": "nav.logs",
    "/compliance": "nav.compliance",
    "/privacy": "nav.privacy",
    "/migration": "nav.migration",
    "/help": "nav.help",
    "/feedback": "nav.feedback",
};

/** Route groups: separators between groups; within a group, order matches sidebar-style UX. */
const NATIVE_GO_GROUPS: readonly (readonly string[])[] = [
    ["/", "/appointments"],
    ["/patients", "/charts/to-validate", "/inbox", "/tickets", "/prescriptions", "/certificates", "/statistics", "/balance-sheet"],
    ["/finance", "/finance/cash", "/purchase-orders", "/services", "/products"],
    ["/administration"],
    ["/settings"],
    ["/audit", "/ops", "/logs", "/compliance", "/privacy", "/migration"],
    ["/help", "/feedback"],
];

export function visibilityForNativeGoPath(path: string): NavVisibility {
    if (path === "/") return ROUTE_VISIBILITY[""];
    const key = path.startsWith("/") ? path.slice(1) : path;
    const version = ROUTE_VISIBILITY[key];
    if (!version) throw new Error(`native-go-menu: missing ROUTE_VISIBILITY for path "${path}"`);
    return version;
}

/** SessionStorage: calendar toolbar action deferred until `/appointments` is mounted. */
export const MEDOC_PENDING_APPOINTMENT_MENU_KEY = "medoc-pending-appointment-menu-v1";

export type NativeFileNewGate = {
    appointment: boolean;
    patient: boolean;
    payment: boolean;
    purchase_order: boolean;
    service_item: boolean;
    balance_sheet: boolean;
};

export type SyncNativeMenuPayload = {
    goItems: NativeGoMenuPayloadItem[];
    fileNew: NativeFileNewGate;
    helpShowPrivacy: boolean;
    viewShowCalendar: boolean;
};

/** Menu "File → New …" — same logic as routes (`appointment.write`, `finance.write`, …). */
export function buildNativeFileNewGate(role: string | undefined): NativeFileNewGate {
    return {
        appointment: navVisibilitySatisfied({ kind: "action", action: "appointment.write" }, role),
        patient: navVisibilitySatisfied({ kind: "action", action: "patient.write" }, role),
        payment: navVisibilitySatisfied({ kind: "action", action: "finance.write" }, role),
        purchase_order: navVisibilitySatisfied({ kind: "action", action: "purchase_order.write" }, role),
        service_item:
            SERVICES_MENU_ENABLED
            && navVisibilitySatisfied({ kind: "action", action: "finance.write" }, role),
        // TODO(deferred-roles): was ["PHYSICIAN", "TAX_ADVISOR"]
        balance_sheet: navVisibilitySatisfied({ kind: "roles", roles: ["PHYSICIAN"] }, role),
    };
}

export function buildSyncNativeMenuPayload(role: string | undefined, t: (key: string) => string): SyncNativeMenuPayload {
    return {
        goItems: buildNativeGoMenuItems(role, t),
        fileNew: buildNativeFileNewGate(role),
        helpShowPrivacy:
            PRIVACY_UI_ENABLED
            && navVisibilitySatisfied(ROUTE_VISIBILITY.privacy, role),
        viewShowCalendar: navVisibilitySatisfied({ kind: "action", action: "appointment.read" }, role),
    };
}

/**
 * Builds "Go to" rows for {@link buildSyncNativeMenuPayload}. Labels via `t()` / locale.
 */
export function buildNativeGoMenuItems(role: string | undefined, t: (key: string) => string): NativeGoMenuPayloadItem[] {
    const out: NativeGoMenuPayloadItem[] = [];
    for (const group of NATIVE_GO_GROUPS) {
        const slice: NativeGoMenuPayloadItem[] = [];
        for (const path of group) {
            if (!INBOX_UI_ENABLED && path === "/inbox") continue;
            if (!PRIVACY_UI_ENABLED && path === "/privacy") continue;
            if (!PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED && (path === "/prescriptions" || path === "/certificates")) continue;
            if (!SERVICES_MENU_ENABLED && path === "/services") continue;
            if (path === "/products") continue;
            if (!navVisibilitySatisfied(visibilityForNativeGoPath(path), role)) continue;
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
