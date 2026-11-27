/** Colours, margins and small helpers of the statistics charts (split from `statistics-chart-kit.tsx`). */
import type { CSSProperties } from "react";
import { isRtlLocale, useLocale } from "@/lib/i18n";

// Apple-system-inspired palette; first color follows selected theme accent (`--accent`).
export const PALETTE = [
    "var(--accent)",
    "#0A84FF", // blue
    "#FF9500", // orange
    "#AF52DE", // purple
    "#30D158", // green
    "#FF3B30", // red
    "#FFCC00", // yellow
    "#5AC8FA", // light blue
];

export const CHART_TICK = "var(--fg-3)";
export const CHART_AXIS = "color-mix(in oklab, var(--fg) 18%, transparent)";
export const CHART_GRID = "color-mix(in oklab, var(--fg) 11%, transparent)";
export const CHART_CURSOR = "color-mix(in oklab, var(--fg) 7%, transparent)";
export const CHART_TOOLTIP_STYLE: CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--line)",
    fontSize: 12,
    background: "var(--bg-elev)",
    color: "var(--fg)",
    boxShadow: "var(--shadow-md)",
};

export function useChartRtl(): boolean {
    return isRtlLocale(useLocale((s) => s.locale));
}

export function cartesianMargin(rtl: boolean, opts?: { top?: number; bottom?: number }) {
    const top = opts?.top ?? 8;
    const bottom = opts?.bottom ?? 12;
    return rtl ? { top, right: 4, left: 8, bottom } : { top, right: 8, left: 0, bottom };
}

export const XHTML_NS = { xmlns: "http://www.w3.org/1999/xhtml" } as unknown as { xmlns?: never };

export function numProp(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
