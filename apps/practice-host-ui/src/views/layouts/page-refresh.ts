import { useEffect, useRef } from "react";

/** Shell broadcasts this so the open page reloads its data without unloading the document. */
export const PAGE_REFRESH_EVENT = "medoc-page-refresh";

/** Background reload of the open page. */
export const PAGE_REFRESH_MS = 5_000;

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
