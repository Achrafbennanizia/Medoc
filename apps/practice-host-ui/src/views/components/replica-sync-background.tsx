/**
 * Background replica sync — 500 ms cadence while healthy, exponential
 * backoff on errors. The first tick runs immediately.
 */

import { useEffect, useRef } from "react";

import { syncGetStatus, syncRunNow } from "@/systems/practice-host/controllers/sync.controller";
import { errorMessage, masterDeviceUnreachable } from "@/lib/utils";
import { useTParams } from "@/lib/i18n";
import { useReplicaSyncStatusStore } from "@/models/store/replica-sync-status-store";
import { useToastStore } from "@/views/components/ui/toast-store";

const SYNC_INTERVAL_MS = 500;
/** Master and unpaired windows only need a slow role check. */
const IDLE_STATUS_MS = 10_000;
const MASTER_DOWN_DELAY_MS = 15_000;
/** Error backoff: 1 s, 2 s, 4 s … capped at 30 s (was a fixed 500 ms retry). */
const ERROR_BACKOFF_BASE_MS = 1_000;
const ERROR_BACKOFF_MAX_MS = 30_000;
/** Same error is toasted at most once per this window (was every 500 ms). */
const TOAST_REPEAT_MS = 5 * 60_000;

export function ReplicaSyncBackground() {
    const running = useRef(false);
    const timerRef = useRef<number | null>(null);
    const failures = useRef(0);
    const lastToast = useRef<{ message: string; at: number } | null>(null);
    const toast = useToastStore((s) => s.add);
    const tp = useTParams();
    const setLastSyncError = useReplicaSyncStatusStore((s) => s.setLastError);

    useEffect(() => {
        let cancelled = false;

        const clearTimer = () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const schedule = (delayMs: number) => {
            if (cancelled) return;
            clearTimer();
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                void tick();
            }, delayMs);
        };

        const toastOnce = (message: string) => {
            const now = Date.now();
            const prev = lastToast.current;
            if (prev && prev.message === message && now - prev.at < TOAST_REPEAT_MS) return;
            lastToast.current = { message, at: now };
            toast(tp("replica.sync.background_error", { error: message }), "warning");
        };

        /** Returns the delay before the next tick. */
        const onError = (message: string): number => {
            if (masterDeviceUnreachable(message)) {
                // Expected while the main device is off; not an error for the user.
                setLastSyncError(null);
                failures.current = 0;
                return MASTER_DOWN_DELAY_MS;
            }
            setLastSyncError(message);
            toastOnce(message);
            failures.current = Math.min(failures.current + 1, 16);
            return Math.min(ERROR_BACKOFF_BASE_MS * 2 ** (failures.current - 1), ERROR_BACKOFF_MAX_MS);
        };

        const tick = async () => {
            if (cancelled) return;
            if (running.current) {
                schedule(SYNC_INTERVAL_MS);
                return;
            }
            running.current = true;
            let nextDelay = SYNC_INTERVAL_MS;
            try {
                const snap = await syncGetStatus();
                const isReplica =
                    snap.deployment.mode === "serverless_peer" && snap.deployment.role === "REPLICA";
                if (!isReplica || !snap.deployment.masterBaseUrl?.trim()) {
                    nextDelay = IDLE_STATUS_MS;
                    return;
                }
                const report = await syncRunNow();
                if (report.error) {
                    nextDelay = onError(report.error);
                } else {
                    failures.current = 0;
                    lastToast.current = null;
                    setLastSyncError(null);
                    // Remote practice_task / in_app_notification rows may have landed.
                    window.dispatchEvent(new Event("medoc-in-app-notifications-refresh"));
                    window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
                }
            } catch (e) {
                nextDelay = onError(errorMessage(e));
            } finally {
                running.current = false;
                schedule(nextDelay);
            }
        };

        void tick();
        const onOnline = () => {
            failures.current = 0;
            void tick();
        };
        window.addEventListener("online", onOnline);

        return () => {
            cancelled = true;
            clearTimer();
            window.removeEventListener("online", onOnline);
        };
    }, [toast, tp, setLastSyncError]);

    return null;
}
