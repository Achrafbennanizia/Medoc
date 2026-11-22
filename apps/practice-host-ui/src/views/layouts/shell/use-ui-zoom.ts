/** Session zoom (Ctrl/⌘ + / − / 0 and the View menu). Multiplies with the text size from Appearance. */
import { useCallback, useEffect, useState } from "react";
import { setSessionZoom } from "@/lib/display-preferences";
import { clampUiZoom, readStoredUiZoom, UI_ZOOM_KEY } from "./shell-preferences";

const STEP = 0.1;

export function useUiZoom(): { zoomIn: () => void; zoomOut: () => void; zoomReset: () => void } {
    const [zoom, setZoom] = useState(readStoredUiZoom);
    useEffect(() => {
        setSessionZoom(zoom);
        try {
            sessionStorage.setItem(UI_ZOOM_KEY, String(zoom));
        } catch {
            /* storage blocked: zoom still applies for this window */
        }
    }, [zoom]);
    return {
        zoomIn: useCallback(() => setZoom((z) => clampUiZoom(z + STEP)), []),
        zoomOut: useCallback(() => setZoom((z) => clampUiZoom(z - STEP)), []),
        zoomReset: useCallback(() => setZoom(1), []),
    };
}
