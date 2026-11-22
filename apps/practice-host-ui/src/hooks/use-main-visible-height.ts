import { useLayoutEffect, type RefObject } from "react";

/** Right-hand panels of list/detail pages (layout/master-detail.css) and other side columns. */
export const SIDE_PANEL_SELECTOR =
    ".products-workspace__detail, .services-workspace__detail, .staff-workspace__detail, .work_hours-aside-col, [data-side-panel]";

/** Gap kept below a side panel so it never touches the window edge. */
const BOTTOM_GAP_PX = 16;
/** Matches `top` of the sticky panels in master-detail.css (var(--space-2)). */
const STICKY_TOP_PX = 8;

/**
 * Height a side panel may use: from where it starts on screen (or its sticky position once the page has
 * scrolled) to the bottom of the main area, minus a gap. Pure, so it is unit-tested.
 */
export function sidePanelMaxHeight(panelTop: number, mainTop: number, mainBottom: number): number {
    const start = Math.max(panelTop, mainTop + STICKY_TOP_PX);
    return Math.max(160, Math.round(mainBottom - start - BOTTOM_GAP_PX));
}

/**
 * Publishes the visible height of the main scroll area as `--main-visible-height` on <html>, and on every
 * side panel inside it `--side-panel-max-height`: the room left between the panel's top and the window
 * bottom. With only the first, a panel below the page header was as tall as the whole area and ran past
 * the bottom edge until the page was scrolled.
 */
export function useMainVisibleHeight(ref: RefObject<HTMLElement | null>): void {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const root = document.documentElement;
        let frame = 0;
        const measure = () => {
            root.style.setProperty("--main-visible-height", `${el.clientHeight}px`);
            const main = el.getBoundingClientRect();
            el.querySelectorAll<HTMLElement>(SIDE_PANEL_SELECTOR).forEach((panel) => {
                const next = `${sidePanelMaxHeight(panel.getBoundingClientRect().top, main.top, main.bottom)}px`;
                if (panel.style.getPropertyValue("--side-panel-max-height") !== next) panel.style.setProperty("--side-panel-max-height", next);
            });
        };
        const publish = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        };
        publish();
        const ro = new ResizeObserver(publish);
        ro.observe(el);
        // New pages / panels appearing (route change, selection) and scrolling change where panels start.
        const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(publish);
        mo?.observe(el, { childList: true, subtree: true });
        el.addEventListener("scroll", publish, { passive: true });
        window.addEventListener("resize", publish);
        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
            mo?.disconnect();
            el.removeEventListener("scroll", publish);
            window.removeEventListener("resize", publish);
            root.style.removeProperty("--main-visible-height");
        };
    }, [ref]);
}
