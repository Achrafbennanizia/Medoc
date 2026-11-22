/** Read-only measurements of the live page for dev scripts (no side effects). */
import { px } from "./dom";

/** Computed styles that each Appearance option is supposed to change. */
export function appearanceSignature(): Record<string, unknown> {
    const q = (sel: string) => document.querySelector<HTMLElement>(sel);
    const cs = (el: Element | null, prop: string) => (el ? getComputedStyle(el).getPropertyValue(prop).trim() : null);
    const root = document.documentElement;
    const btn = q("main .btn") ?? q("main button");
    const row = q(".data-table__row") ?? q("main tbody tr");
    return {
        attrs: { ...root.dataset },
        fg: cs(document.body, "color"),
        bg: cs(q("main"), "background-color") ?? cs(document.body, "background-color"),
        cardBg: cs(q("main .card"), "background-color"),
        line: cs(root, "--line"),
        font: cs(document.body, "font-family")?.slice(0, 40),
        letterSpacing: cs(document.body, "letter-spacing"),
        wordSpacing: cs(document.body, "word-spacing"),
        accent: cs(root, "--accent"),
        sidebarBg: cs(q(".app-sidebar"), "background-color"),
        rowH: row ? px(row.getBoundingClientRect().height) : null,
        cardPadY: cs(root, "--card-pad-y"),
        btnH: btn ? px(btn.getBoundingClientRect().height) : null,
        btnTransition: cs(btn, "transition-duration"),
        linkDecoration: cs(q("main a[href]"), "text-decoration-line"),
        statusBg: cs(q(".status-badge .pill"), "background-color"),
        headerAvatar: cs(q(".topbar .topbar-user-av"), "display"),
        kbdHint: cs(q(".ui-kbd-hint"), "display"),
        pageTitleSize: cs(q(".page-title"), "font-size"),
        rail: root.dataset.sidebarRail ?? "full",
        viewportW: window.innerWidth,
        cssZoom: root.style.zoom || "",
        zoomError: (window as unknown as { __medocZoomError?: string }).__medocZoomError ?? null,
        tauriInternals: "__TAURI_INTERNALS__" in window,
        dpr: window.devicePixelRatio,
        visualW: window.visualViewport?.width ?? null,
        clientW: root.clientWidth,
    };
}

/** Tables that do not fill their card, side panels that cannot scroll, anything wider than the viewport. */
export function layoutReport(): Record<string, unknown> {
    const vw = document.documentElement.clientWidth;
    const tables = Array.from(document.querySelectorAll<HTMLElement>(".data-table-wrap, .tbl-scroll")).map((wrap) => {
        const table = wrap.querySelector("table");
        const host = (wrap.closest(".card") as HTMLElement | null) ?? (wrap.parentElement as HTMLElement | null);
        return {
            kind: wrap.classList.contains("data-table-wrap") ? "DataTable" : "legacy",
            label: table?.getAttribute("aria-label") ?? table?.className ?? "",
            hostW: host ? px(host.clientWidth) : null,
            wrapW: px(wrap.clientWidth),
            tableW: table ? px(table.getBoundingClientRect().width) : null,
            fills: table && host ? table.getBoundingClientRect().width >= host.clientWidth - 4 : null,
            hScroll: wrap.scrollWidth > wrap.clientWidth + 1,
            cols: wrap.querySelectorAll("thead th").length,
            hiddenCols: Array.from(wrap.querySelectorAll("thead th")).filter((th) => getComputedStyle(th).display === "none").length,
            rows: wrap.querySelectorAll("tbody tr").length,
        };
    });
    const panes = Array.from(
        document.querySelectorAll<HTMLElement>(".staff-workspace__detail, .products-workspace__detail, .services-workspace__detail, .master-detail__detail"),
    ).map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
            cls: el.className,
            h: px(el.clientHeight),
            contentH: px(el.scrollHeight),
            overflowY: cs.overflowY,
            position: cs.position,
            canScroll: el.scrollHeight <= el.clientHeight + 1 || cs.overflowY === "auto" || cs.overflowY === "scroll",
            top: px(r.top),
            bottom: px(r.bottom),
            maxH: cs.maxHeight,
            mainVisibleH: getComputedStyle(document.documentElement).getPropertyValue("--main-visible-height").trim(),
        };
    });
    const wide = Array.from(document.querySelectorAll<HTMLElement>("main *"))
        .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== "fixed")
        .slice(0, 8)
        .map((el) => `${describe(el, 2)} r=${px(el.getBoundingClientRect().right)}`);
    return { path: window.location.pathname, viewport: { w: vw, h: window.innerHeight }, pageHScroll: document.documentElement.scrollWidth > vw + 1, tables, panes, overflowingRight: wide };
}

/** Size, overflow, visibility and layout of an element and each ancestor: finds the one that collapses. */
export function ancestorChain(start: HTMLElement | null, max = 18): Record<string, unknown>[] {
    const chain: Record<string, unknown>[] = [];
    for (let el = start; el && chain.length < max; el = el.parentElement) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        chain.push({
            el: describe(el, 3),
            w: px(r.width),
            h: px(r.height),
            top: px(r.top),
            clientH: el.clientHeight,
            overflowY: cs.overflowY,
            opacity: cs.opacity,
            visibility: cs.visibility,
            transform: cs.transform,
            anim: cs.animationName,
            display: cs.display,
            flex: cs.flex,
            minW: cs.minWidth,
            gridCols: cs.display.includes("grid") ? cs.gridTemplateColumns : undefined,
            container: cs.containerType !== "normal" ? cs.containerType : undefined,
        });
    }
    return chain;
}

/** Larger click targets: visible interactive elements under 44 px (docs/ui/large-targets-plan.md). */
export function smallTargets(limit = 60): string[] {
    const sel = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], a[href], input, select, textarea, .sb-item, .tb-chip, .select-trigger';
    return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            if (el.closest("[data-target-exempt], .window-controls")) return false;
            if (el.tagName === "A" && el.closest("p")) return false; // inline text links (WCAG exception)
            const minW = el.matches(".icon-btn, [aria-label]:not(:has(*:not(svg, svg *)))") ? 44 : 0;
            return r.height < 43.5 || r.width < minW;
        })
        .slice(0, limit)
        .map((el) => {
            const r = el.getBoundingClientRect();
            const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
            return `${describe(el, 2)} "${label}" ${px(r.width)}x${px(r.height)}`;
        });
}

function describe(el: Element, classes: number): string {
    return `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, classes).join(".")}`;
}
