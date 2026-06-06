import type { CSSProperties } from "react";

/** KPI-Icon-Hintergrund: Hex (`#RRGGBB` + Alpha-Suffix) oder CSS-Variable (`var(--accent)`). */
export function kpiIconChrome(accent: string): Pick<CSSProperties, "background" | "color"> {
    const a = accent.trim();
    if (a.startsWith("var(")) {
        return {
            background: `color-mix(in oklab, ${a} 15%, transparent)`,
            color: a,
        };
    }
    return { background: `${accent}20`, color: accent };
}
