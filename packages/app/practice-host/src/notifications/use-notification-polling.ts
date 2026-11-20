import { useEffect, useRef } from "react";
import { APPOINTMENTS_CHANGED_EVENT } from "../controllers/appointment.controller";
import { useNotificationCenter, type NotificationDelivery } from "./notification-center";

const POLL_MS = 30_000;

type Params = {
    userId: string | undefined;
    role: string | undefined;
    t: (key: string) => string;
    tp: (key: string, params: Record<string, string | number>) => string;
    delivery: NotificationDelivery;
};

/** Keeps the notification center fresh: interval, window focus, and domain change events. */
export function useNotificationPolling({ userId, role, t, tp, delivery }: Params): void {
    const refresh = useNotificationCenter((s) => s.refresh);
    const reset = useNotificationCenter((s) => s.reset);
    const deps = useRef({ t, tp, delivery, role });
    useEffect(() => {
        deps.current = { t, tp, delivery, role };
    });

    useEffect(() => {
        if (!userId) {
            reset();
            return;
        }
        const run = () => {
            const d = deps.current;
            void refresh({ userId, role: d.role ?? "", t: d.t, tp: d.tp }, d.delivery);
        };
        run();
        const id = window.setInterval(run, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") run();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener(APPOINTMENTS_CHANGED_EVENT, run);
        window.addEventListener("medoc-nav-badges-refresh", run);
        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener(APPOINTMENTS_CHANGED_EVENT, run);
            window.removeEventListener("medoc-nav-badges-refresh", run);
        };
    }, [userId, refresh, reset]);
}
