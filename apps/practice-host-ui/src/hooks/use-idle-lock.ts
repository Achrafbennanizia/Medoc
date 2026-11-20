import { useEffect, useRef } from "react";
import { useClientSettings } from "@/lib/use-client-settings";

/** Shared across app windows so activity in one window keeps the others signed in. */
const LAST_ACTIVITY_KEY = "medoc-last-activity-at";
const WARN_BEFORE_MS = 60_000;
const TICK_MS = 5_000;
/** Activity events, captured (scroll inside <main> does not bubble to document otherwise). */
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

export type IdleLockCallbacks = {
    /** Called once when the warning window starts (≤ 60 s left). */
    onWarn: (secondsLeft: number) => void;
    /** Called once when activity resumes after a warning. */
    onResume: () => void;
    /** Perform sign-out; called once per idle period. */
    onLock: () => Promise<void> | void;
};

function readSharedActivity(): number {
    try {
        return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
    } catch {
        return 0;
    }
}

/**
 * Auto-lock after inactivity (Settings → Security → "Auto-lock after inactivity").
 * - Reacts to the setting immediately (no re-login needed).
 * - Warns one minute before signing out; any input cancels the warning.
 * - Signs out exactly once; activity in another MeDoc window counts too.
 */
export function useIdleLock(active: boolean, cb: IdleLockCallbacks): void {
    const minutes = useClientSettings((s) => Math.max(0, Number(s.security?.idleLogoutMinutes ?? 0) || 0));
    const cbRef = useRef(cb);
    useEffect(() => {
        cbRef.current = cb;
    });

    useEffect(() => {
        if (!active || minutes <= 0) return;
        const limitMs = minutes * 60_000;
        let last = Date.now();
        let warned = false;
        let locking = false;
        let lastShared = 0;

        const bump = () => {
            last = Date.now();
            if (last - lastShared > 2_000) {
                lastShared = last;
                try {
                    localStorage.setItem(LAST_ACTIVITY_KEY, String(last));
                } catch {
                    /* private mode */
                }
            }
            if (warned) {
                warned = false;
                cbRef.current.onResume();
            }
        };
        bump();
        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));

        const tick = window.setInterval(() => {
            if (locking) return;
            const lastAny = Math.max(last, readSharedActivity());
            const idle = Date.now() - lastAny;
            if (idle >= limitMs) {
                locking = true;
                void Promise.resolve(cbRef.current.onLock());
                return;
            }
            const left = limitMs - idle;
            if (!warned && left <= WARN_BEFORE_MS) {
                warned = true;
                cbRef.current.onWarn(Math.ceil(left / 1000));
            } else if (warned && left > WARN_BEFORE_MS) {
                warned = false;
                cbRef.current.onResume();
            }
        }, TICK_MS);

        return () => {
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
            window.clearInterval(tick);
        };
    }, [active, minutes]);
}
