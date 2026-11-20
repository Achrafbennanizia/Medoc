/**
 * Keyboard shortcut registry — documentation source for Help → Keyboard shortcuts and the command palette.
 *
 * Keep in sync with the handlers that implement them:
 * - global: `apps/practice-host-ui/src/views/layouts/app-layout.tsx` (⌘K, ⌘N, ⌘R, zoom, Alt+1…9, ?)
 * - schedule: `apps/practice-host-ui/src/views/pages/appointments.tsx` (D/W/M/H, ←/→)
 * - dialogs/lists: `packages/ui` dialog + command palette (Esc, ↑/↓, Enter)
 *
 * `mod` renders as ⌘ on macOS and Ctrl elsewhere.
 */
export type ShortcutGroup = "global" | "navigation" | "view" | "calendar" | "dialogs";

export type ShortcutDef = {
    readonly id: string;
    readonly group: ShortcutGroup;
    /** Key chords; each chord is a list of keys pressed together. Alternatives are separate chords. */
    readonly chords: readonly (readonly string[])[];
    readonly labelKey: string;
};

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["global", "navigation", "calendar", "view", "dialogs"];

export const SHORTCUTS: readonly ShortcutDef[] = [
    { id: "palette", group: "global", chords: [["mod", "K"], ["mod", "Shift", "P"]], labelKey: "help.shortcuts.cmdk" },
    { id: "new-appointment", group: "global", chords: [["mod", "N"]], labelKey: "help.shortcuts.new_appointment" },
    { id: "help", group: "global", chords: [["?"]], labelKey: "help.shortcuts.help" },
    { id: "reload", group: "global", chords: [["mod", "R"]], labelKey: "help.shortcuts.reload" },
    { id: "nav-n", group: "navigation", chords: [["Alt", "1…9"]], labelKey: "help.shortcuts.nav_n" },
    { id: "tab", group: "navigation", chords: [["Tab"], ["Shift", "Tab"]], labelKey: "help.shortcuts.tab" },
    { id: "cal-day", group: "calendar", chords: [["D"]], labelKey: "help.shortcuts.cal_day" },
    { id: "cal-week", group: "calendar", chords: [["W"]], labelKey: "help.shortcuts.cal_week" },
    { id: "cal-month", group: "calendar", chords: [["M"]], labelKey: "help.shortcuts.cal_month" },
    { id: "cal-today", group: "calendar", chords: [["T"]], labelKey: "help.shortcuts.cal_today" },
    { id: "cal-new", group: "calendar", chords: [["N"]], labelKey: "help.shortcuts.new_appointment" },
    { id: "cal-prev-next", group: "calendar", chords: [["←"], ["→"]], labelKey: "help.shortcuts.cal_prev_next" },
    { id: "zoom-in", group: "view", chords: [["mod", "+"]], labelKey: "help.shortcuts.zoom_in" },
    { id: "zoom-out", group: "view", chords: [["mod", "−"]], labelKey: "help.shortcuts.zoom_out" },
    { id: "zoom-reset", group: "view", chords: [["mod", "0"]], labelKey: "help.shortcuts.zoom_reset" },
    { id: "esc", group: "dialogs", chords: [["Esc"]], labelKey: "help.shortcuts.esc" },
    { id: "arrows", group: "dialogs", chords: [["↑"], ["↓"]], labelKey: "help.shortcuts.arrows" },
    { id: "enter", group: "dialogs", chords: [["Enter"]], labelKey: "help.shortcuts.enter" },
];

export function isMacPlatform(): boolean {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const p = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
    return /mac|iphone|ipad/i.test(p);
}

/** Render a key for the current platform (`mod` → ⌘ / Ctrl, `Alt` → ⌥ on macOS). */
export function displayKey(key: string, mac = isMacPlatform()): string {
    if (key === "mod") return mac ? "⌘" : "Ctrl";
    if (key === "Alt") return mac ? "⌥" : "Alt";
    if (key === "Shift") return mac ? "⇧" : "Shift";
    return key;
}
