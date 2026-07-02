import type { CSSProperties } from "react";

/** KPI icon background: hex (`#RRGGBB` + alpha suffix) or CSS variable (`var(--accent)`). */
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
