/**
 * Accessibility & comfort preferences (Settings → Appearance). One module owns the vocabulary and how it is
 * applied to <html>, so the settings page, the shell and pre-login screens all behave the same.
 *
 * Every option is a `data-*` attribute on <html> styled in `styles/themes/accessibility.css`, except text
 * size, which multiplies into the page zoom (the app uses fixed px type, so zoom is the only uniform scale).
 */
/**
 * Text sizes, by name. 100 % (Normal) is the original app size and the baseline.
 *
 * Screen rule: on a normal screen (laptop, < 1920 × 1050) text size × ⌘+ zoom stops at 110 % — beyond that
 * the minimum window (1250 × 800) loses whole columns and forms scroll sideways. On a big screen the window
 * can be large enough, so Larger (120 %) and Largest (130 %) are offered as well.
 */
export const TEXT_SCALES = [1, 1.1, 1.2, 1.3] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export const TEXT_SCALE_NAMES: Record<TextScale, "normal" | "large" | "larger" | "largest"> = {
    1: "normal",
    1.1: "large",
    1.2: "larger",
    1.3: "largest",
};
/** 100 % is the original app size and the baseline: zoom and text size only enlarge from there. */
export const MIN_TOTAL_ZOOM = 1;
export const SMALL_SCREEN_MAX_ZOOM = 1.1;
export const BIG_SCREEN_MAX_ZOOM = 1.3;
export const BIG_SCREEN_MIN = { width: 1920, height: 1050 } as const;

/** Display (not window) is big enough for sizes above 110 %. */
export function isBigScreen(): boolean {
    if (typeof window === "undefined" || !window.screen) return false;
    return window.screen.width >= BIG_SCREEN_MIN.width && window.screen.height >= BIG_SCREEN_MIN.height;
}

/** Highest text size × zoom allowed on this display. */
export function maxTotalZoom(): number {
    return isBigScreen() ? BIG_SCREEN_MAX_ZOOM : SMALL_SCREEN_MAX_ZOOM;
}

/** Whether a text size can be chosen on this display (larger ones show disabled with the reason). */
export function textScaleAvailable(scale: TextScale): boolean {
    return scale <= maxTotalZoom() + 0.001;
}

/**
 * Menu rule (no setting): the side menu turns into the compact icon rail when the page is narrower than
 * this many CSS px — a small window, or text size / zoom on a small screen (1250 px at 110 % = 1136 px).
 * The user's own sidebar toggle still works; the rule only acts when the width crosses the threshold.
 */
export const AUTO_COMPACT_BELOW_PX = 1200;

export type ContrastMode = "standard" | "high";
export type StartPage = "auto" | "dashboard" | "appointments" | "patients" | "tickets";

export type DisplayPreferences = {
    textScale: TextScale;
    contrast: ContrastMode;
    reduceMotion: boolean;
    underlineLinks: boolean;
    largeTargets: boolean;
    readingSpacing: boolean;
    colorBlindStatus: boolean;
    startPage: StartPage;
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
    textScale: 1,
    contrast: "standard",
    reduceMotion: false,
    underlineLinks: false,
    largeTargets: false,
    readingSpacing: false,
    colorBlindStatus: false,
    startPage: "auto",
};

export function normalizeDisplayPreferences(raw: Partial<DisplayPreferences> | undefined): DisplayPreferences {
    const r = raw ?? {};
    // Older saves used 1.12 / 1.25 / 1.4 / 1.5 / 1.75: keep the nearest offered size that is not larger.
    // (The screen limit is applied later, in effectiveZoom, so a saved size returns on a big screen.)
    const rawScale = typeof r.textScale === "number" && Number.isFinite(r.textScale) ? r.textScale : 1;
    const scale = [...TEXT_SCALES].reverse().find((s) => s <= rawScale + 0.001) ?? 1;
    const start: StartPage[] = ["auto", "dashboard", "appointments", "patients", "tickets"];
    return {
        textScale: scale,
        contrast: r.contrast === "high" ? "high" : "standard",
        reduceMotion: r.reduceMotion === true,
        underlineLinks: r.underlineLinks === true,
        largeTargets: r.largeTargets === true,
        readingSpacing: r.readingSpacing === true,
        colorBlindStatus: r.colorBlindStatus === true,
        startPage: start.includes(r.startPage as StartPage) ? (r.startPage as StartPage) : "auto",
    };
}

/** Session zoom from Ctrl/⌘ +/− (kept by the shell); text size multiplies it. */
let sessionZoom = 1;
let textScale: number = 1;

/** Text size × session zoom, clamped to [MIN_TOTAL_ZOOM, maxTotalZoom()] for this display. */
export function effectiveZoom(): number {
    const raw = Math.round(sessionZoom * textScale * 1000) / 1000;
    return Math.min(maxTotalZoom(), Math.max(MIN_TOTAL_ZOOM, raw));
}

let lastMenuCompact: boolean | null = null;

/** `true` when the automatic rule wants the compact rail for the current page width. */
export function menuCompactPreference(): boolean {
    if (typeof window === "undefined") return false;
    return window.innerWidth < AUTO_COMPACT_BELOW_PX;
}

/**
 * Tells the shell (app-layout) when the automatic menu rule flips: `medoc-menu-size` with `{ compact }`.
 * Fires only on a change, so between flips the user's sidebar toggle is respected.
 */
function publishMenuSize(): void {
    if (typeof window === "undefined") return;
    const compact = menuCompactPreference();
    if (compact === lastMenuCompact) return;
    lastMenuCompact = compact;
    window.dispatchEvent(new CustomEvent("medoc-menu-size", { detail: { compact } }));
}

let menuRuleInstalled = false;
/** Re-evaluate the menu rule when the window or the zoom changes the page width (native zoom resizes). */
function installMenuRule(): void {
    if (menuRuleInstalled || typeof window === "undefined") return;
    menuRuleInstalled = true;
    let frame = 0;
    window.addEventListener("resize", () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(publishMenuSize);
    });
}

/** Last zoom handed to the native webview, so repeated calls with the same value cost nothing. */
let nativeZoomApplied = 1;

/**
 * Applies session zoom × text size.
 *
 * In the desktop app this is the webview's native zoom (like browser zoom). CSS `zoom` on <html> was used
 * before, but WebKit then evaluates media queries, container queries and vh/dvh in different units: at
 * 150 % the page was taller than the window and responsive columns/layouts did not switch. Native zoom
 * keeps every CSS unit consistent. CSS zoom stays as the fallback outside Tauri (unit tests, plain browser).
 */
function applyZoom(): void {
    if (typeof document === "undefined") return;
    const z = effectiveZoom();
    const root = document.documentElement.style;
    const tauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (tauri) {
        root.zoom = "";
        root.removeProperty("--app-zoom");
        if (z === nativeZoomApplied) return;
        nativeZoomApplied = z;
        void import("@tauri-apps/api/webview")
            .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(z))
            .catch((e: unknown) => {
                (window as unknown as { __medocZoomError?: string }).__medocZoomError = String(e);
                // Permission missing or old runtime: fall back to CSS zoom rather than ignoring the setting.
                root.zoom = z === 1 ? "" : String(z);
                if (z === 1) root.removeProperty("--app-zoom");
                else root.setProperty("--app-zoom", String(z));
            });
        return;
    }
    root.zoom = z === 1 ? "" : String(z);
    // vh/dvh are not divided by CSS zoom; `--app-dvh` (theme.css) uses this to stay equal to the window.
    if (z === 1) root.removeProperty("--app-zoom");
    else root.setProperty("--app-zoom", String(z));
}

/** Called by the shell when the user zooms with the keyboard. */
export function setSessionZoom(z: number): void {
    sessionZoom = z;
    applyZoom();
    publishMenuSize();
}

export function applyDisplayPreferences(p: DisplayPreferences): void {
    if (typeof document === "undefined") return;
    const ds = document.documentElement.dataset;
    ds.contrast = p.contrast;
    ds.motion = p.reduceMotion ? "reduced" : "full";
    ds.underlineLinks = String(p.underlineLinks);
    ds.targets = p.largeTargets ? "large" : "standard";
    ds.readingSpacing = String(p.readingSpacing);
    ds.statusPalette = p.colorBlindStatus ? "cb" : "standard";
    ds.textScale = String(Math.round(p.textScale * 100));
    textScale = p.textScale;
    applyZoom();
    installMenuRule();
    publishMenuSize();
}

/** Route to open after sign-in (`auto` = role default). */
export function startPagePath(p: DisplayPreferences, roleDefault: string): string {
    switch (p.startPage) {
        case "dashboard":
            return "/";
        case "appointments":
            return "/appointments";
        case "patients":
            return "/patients";
        case "tickets":
            return "/tickets";
        default:
            return roleDefault;
    }
}
