import { useEffect, useRef } from "react";

/** Shell broadcasts this so the open page reloads its data without unloading the document. */
export const PAGE_REFRESH_EVENT = "medoc-page-refresh";

/** Reload of the page that is on screen. */
export const PAGE_REFRESH_MS = 5_000;

/** Reload while the window is in the background. */
export const PAGE_REFRESH_HIDDEN_MS = 3 * 60 * 1000;

export function usePageRefresh(onRefresh: () => void) {
    const ref = useRef(onRefresh);
    useEffect(() => {
        ref.current = onRefresh;
    }, [onRefresh]);
    useEffect(() => {
        const fn = () => ref.current();
        window.addEventListener(PAGE_REFRESH_EVENT, fn);
        return () => window.removeEventListener(PAGE_REFRESH_EVENT, fn);
    }, []);
}
