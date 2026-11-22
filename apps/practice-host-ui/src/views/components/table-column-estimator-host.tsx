import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLocale } from "@/lib/i18n";
import { distributeColumnWidthsPx } from "@/lib/table-column-estimator";

const ATTR = "data-tbl-measured";
const OPT_OUT = "data-tbl-no-autosize";
const SAMPLE_ROWS = 40;
const DEBOUNCE_MS = 80;

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextPx(text: string, font: string): number {
    if (typeof document === "undefined") return 0;
    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) return text.length * 7;
    ctx.font = font;
    return ctx.measureText(text).width;
}

function cellText(el: Element): string {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function clearMeasured(table: HTMLTableElement): void {
    table.querySelectorAll(`colgroup[${ATTR}]`).forEach((g) => g.remove());
    table.removeAttribute(ATTR);
}

/** Parent width the table is allowed to fill (scroll shell or offset parent). */
function availableTableWidthPx(table: HTMLTableElement): number {
    const shell = table.closest(".tbl-scroll, .tbl-data-card, .card") as HTMLElement | null;
    const host = shell ?? (table.parentElement as HTMLElement | null);
    if (host) {
        const cs = getComputedStyle(host);
        const pad =
            (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const w = host.clientWidth - pad;
        if (w > 0) return w;
    }
    return table.parentElement?.clientWidth || table.clientWidth || 0;
}

function applyEstimates(table: HTMLTableElement): void {
    if (table.hasAttribute(OPT_OUT)) return;
    if (!table.tHead || !table.tBodies.length) return;

    const headerRow = table.tHead.rows[0];
    if (!headerRow) return;
    const colCount = headerRow.cells.length;
    if (colCount < 1) return;

    const availablePx = availableTableWidthPx(table);
    if (availablePx < 80) return;

    const thCs = getComputedStyle(headerRow.cells[0] ?? table);
    const tdSample = table.tBodies[0]?.rows[0]?.cells[0];
    const tdCs = tdSample ? getComputedStyle(tdSample) : thCs;
    const headerFont = `${thCs.fontWeight || "600"} ${thCs.fontSize || "11px"} ${thCs.fontFamily}`;
    const bodyFont = `${tdCs.fontWeight || "400"} ${tdCs.fontSize || "13px"} ${tdCs.fontFamily}`;

    const columns = Array.from({ length: colCount }, (_, i) => {
        const headerPx = measureTextPx(cellText(headerRow.cells[i] ?? headerRow), headerFont);
        const cellWidthsPx: number[] = [];
        let sampled = 0;
        for (const body of Array.from(table.tBodies)) {
            for (const row of Array.from(body.rows)) {
                if (sampled >= SAMPLE_ROWS) break;
                const cell = row.cells[i];
                if (!cell) continue;
                const text = cellText(cell);
                if (text) cellWidthsPx.push(measureTextPx(text, bodyFont));
                sampled += 1;
            }
            if (sampled >= SAMPLE_ROWS) break;
        }
        return { headerPx, cellWidthsPx };
    });

    const widths = distributeColumnWidthsPx(columns, availablePx);

    clearMeasured(table);
    const group = document.createElement("colgroup");
    group.setAttribute(ATTR, "1");
    widths.forEach((w) => {
        const col = document.createElement("col");
        col.style.width = `${w}px`;
        group.appendChild(col);
    });
    table.insertBefore(group, table.firstChild);
    table.setAttribute(ATTR, "1");
    table.style.tableLayout = "fixed";
    table.style.width = "100%";
    table.style.maxWidth = "100%";
    // Drop hard min-widths that force horizontal overflow past the host.
    if (table.style.minWidth) table.style.minWidth = "";
}

function measureAllInRoot(root: ParentNode): void {
    root.querySelectorAll<HTMLTableElement>("table.tbl").forEach((table) => {
        try {
            applyEstimates(table);
        } catch {
            /* ignore per-table failures */
        }
    });
}

/**
 * Default behaviour: fill the host width; split columns by content weight.
 * Remeasures on route, locale, font-stack, resize, and DOM mutations.
 */
export function TableColumnEstimatorHost() {
    const locale = useLocale((s) => s.locale);
    const location = useLocation();
    const timer = useRef<number | null>(null);

    useEffect(() => {
        const main = document.querySelector("main.app-main") ?? document.body;
        const schedule = () => {
            if (timer.current != null) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
                timer.current = null;
                measureAllInRoot(main);
            }, DEBOUNCE_MS);
        };

        main.querySelectorAll<HTMLTableElement>(`table.tbl[${ATTR}]`).forEach(clearMeasured);
        schedule();

        const mo = new MutationObserver(() => schedule());
        mo.observe(main, { childList: true, subtree: true, characterData: true });

        const onFont = () => {
            main.querySelectorAll<HTMLTableElement>(`table.tbl[${ATTR}]`).forEach(clearMeasured);
            schedule();
        };
        const obsFont = new MutationObserver(onFont);
        obsFont.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-font-stack", "lang", "dir"],
        });

        window.addEventListener("resize", schedule);

        return () => {
            mo.disconnect();
            obsFont.disconnect();
            window.removeEventListener("resize", schedule);
            if (timer.current != null) window.clearTimeout(timer.current);
        };
    }, [locale, location.pathname]);

    return null;
}
