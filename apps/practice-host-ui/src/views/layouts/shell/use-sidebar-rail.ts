/**
 * Sidebar width: full or icon rail. Starts compact on a narrow page, follows the automatic width rule
 * (display-preferences `medoc-menu-size`), and remembers only the user's own toggle.
 */
import { useCallback, useEffect, useState } from "react";
import { menuCompactPreference } from "@/lib/display-preferences";
import { readSidebarRailPref, writeSidebarRailPref, type SidebarRailPref } from "./shell-preferences";

export function useSidebarRail(): { rail: SidebarRailPref; toggleRail: () => void } {
    const [rail, setRail] = useState<SidebarRailPref>(() => {
        if (typeof window === "undefined") return "full";
        return menuCompactPreference() ? "icons" : readSidebarRailPref();
    });

    useEffect(() => {
        if (rail === "icons") document.documentElement.dataset.sidebarRail = "icons";
        else delete document.documentElement.dataset.sidebarRail;
    }, [rail]);

    useEffect(() => {
        // Width threshold crossed: compact when narrow, back to the user's choice when wide.
        const onMenuSize = (e: Event) => setRail((e as CustomEvent<{ compact: boolean }>).detail?.compact ? "icons" : readSidebarRailPref());
        window.addEventListener("medoc-menu-size", onMenuSize);
        return () => window.removeEventListener("medoc-menu-size", onMenuSize);
    }, []);

    const toggleRail = useCallback(() => {
        setRail((p) => {
            const next = p === "icons" ? "full" : "icons";
            writeSidebarRailPref(next);
            return next;
        });
    }, []);
    return { rail, toggleRail };
}
