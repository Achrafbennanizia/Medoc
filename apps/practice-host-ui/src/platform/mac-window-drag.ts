import { useCallback, useEffect, useRef, type MouseEvent } from "react";

/**
 * Window drag (single responsibility: move the native window from a *chrome strip*).
 *
 * Rules (enforced here, never in pages):
 * 1. Only elements rendered as a drag strip (`WindowDragStrip` or the unified top bar) may call this.
 *    Content panels (login hero, onboarding stage, forms) must NEVER be drag regions — that was the
 *    "the whole window moves when I click" bug.
 * 2. Dragging starts only after the pointer travels {@link DRAG_THRESHOLD_PX}; a plain click stays a click
 *    and text selection inside chrome still works.
 * 3. Interactive descendants (anything matching {@link NO_DRAG_SELECTOR}) never start a drag.
 * 4. Double-click on the strip toggles maximize (macOS / Windows convention).
 */
export const NO_DRAG_SELECTOR = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "label",
    "[contenteditable='true']",
    "[role='button']",
    "[role='menu']",
    "[role='menuitem']",
    "[role='combobox']",
    "[role='tab']",
    "[data-no-drag]",
    ".input",
    ".tb-chip",
    ".topbar-actions",
    ".app-sidebar-brand-hit",
].join(", ");

const DRAG_THRESHOLD_PX = 4;

function isDragBlocked(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || typeof el.closest !== "function") return true;
    return el.closest(NO_DRAG_SELECTOR) != null;
}

async function startNativeDrag(): Promise<void> {
    try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().startDragging();
    } catch {
        /* browser / tests: no native window */
    }
}

async function toggleNativeMaximize(): Promise<void> {
    try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().toggleMaximize();
    } catch {
        /* noop */
    }
}

/**
 * Returns a `onMouseDown` handler for a drag strip. Arms on mousedown, starts the native drag once the
 * pointer moves past the threshold, and disarms on mouseup — so clicks inside the strip are not swallowed.
 */
export function useMacWindowDrag(enabled: boolean) {
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => () => cleanupRef.current?.(), []);

    return useCallback(
        (e: MouseEvent<HTMLElement>) => {
            if (!enabled || e.button !== 0) return;
            if (isDragBlocked(e.target)) return;

            if (e.detail === 2) {
                void toggleNativeMaximize();
                return;
            }

            const startX = e.clientX;
            const startY = e.clientY;
            cleanupRef.current?.();

            const onMove = (ev: globalThis.MouseEvent) => {
                if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
                cleanup();
                void startNativeDrag();
            };
            const cleanup = () => {
                window.removeEventListener("mousemove", onMove, true);
                window.removeEventListener("mouseup", cleanup, true);
                window.removeEventListener("blur", cleanup);
                cleanupRef.current = null;
            };
            window.addEventListener("mousemove", onMove, true);
            window.addEventListener("mouseup", cleanup, true);
            window.addEventListener("blur", cleanup);
            cleanupRef.current = cleanup;
        },
        [enabled],
    );
}
