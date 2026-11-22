/** Shell preferences kept in browser storage: sidebar rail (full / icons) and the session zoom. */
import { MIN_TOTAL_ZOOM, maxTotalZoom } from "@/lib/display-preferences";

const SIDEBAR_RAIL_PREF_KEY = "medoc-sidebar-rail-pref";
export const UI_ZOOM_KEY = "medoc-ui-zoom";

export type SidebarRailPref = "full" | "icons";

export function readSidebarRailPref(): SidebarRailPref {
    try {
        return localStorage.getItem(SIDEBAR_RAIL_PREF_KEY) === "icons" ? "icons" : "full";
    } catch {
        return "full";
    }
}

export function writeSidebarRailPref(pref: SidebarRailPref): void {
    try {
        localStorage.setItem(SIDEBAR_RAIL_PREF_KEY, pref);
    } catch {
        /* storage blocked: the rail still works for this session */
    }
}

/** Same bounds as text size × zoom together (display-preferences), so ⌘+ cannot push the layout off screen. */
export function clampUiZoom(z: number): number {
    const r = Math.round(z * 100) / 100;
    return Math.min(maxTotalZoom(), Math.max(MIN_TOTAL_ZOOM, r));
}

export function readStoredUiZoom(): number {
    try {
        const s = sessionStorage.getItem(UI_ZOOM_KEY);
        const n = s ? parseFloat(s) : 1;
        return Number.isFinite(n) && n >= MIN_TOTAL_ZOOM && n <= maxTotalZoom() ? Math.round(n * 100) / 100 : 1;
    } catch {
        return 1;
    }
}
