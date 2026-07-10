/**
 * Keeps practice hours (Sprechzeiten) in sync across devices via SQLite `app_kv`.
 * Admin changes on any workstation propagate to all logged-in clients.
 */

import { useEffect } from "react";
import { useAuthStore } from "../../models/store/auth-store";
import {
    bindPraxisArbeitszeitenStoreEvents,
    usePraxisArbeitszeitenStore,
} from "@/models/store/praxis-arbeitszeiten-store";

const REFRESH_INTERVAL_MS = 30_000;

export function PraxisArbeitszeitenBackground() {
    const sessionChecked = useAuthStore((s) => s.sessionChecked);
    const session = useAuthStore((s) => s.session);

    useEffect(() => {
        if (!sessionChecked) return undefined;
        const unbind = bindPraxisArbeitszeitenStoreEvents();
        return unbind;
    }, [sessionChecked]);

    useEffect(() => {
        if (!sessionChecked || !session) return undefined;
        let cancelled = false;

        const refresh = () => {
            if (cancelled) return;
            void usePraxisArbeitszeitenStore.getState().refresh();
        };

        refresh();
        const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
        const onVis = () => {
            if (document.visibilityState === "visible") refresh();
        };
        const onOnline = () => refresh();
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("online", onOnline);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("online", onOnline);
        };
    }, [sessionChecked, session]);

    return null;
}
