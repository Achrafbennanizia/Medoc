/**
 * Background replica sync — same 500 ms cadence as the host loop.
 * The first tick runs immediately.
 */

import { useEffect, useRef } from "react";

import { syncGetStatus, syncRunNow } from "@/systems/practice-host/controllers/sync.controller";
import { errorMessage } from "@/lib/utils";
import { useTParams } from "@/lib/i18n";
import { useReplicaSyncStatusStore } from "@/models/store/replica-sync-status-store";
import { useToastStore } from "@/views/components/ui/toast-store";

const SYNC_INTERVAL_IDLE_MS = 500;
const SYNC_INTERVAL_ACTIVE_MS = 500;
const ERROR_TOAST_COOLDOWN_MS = 60_000;

export function ReplicaSyncBackground() {
    const running = useRef(false);
    const timerRef = useRef<number | null>(null);
    const lastErrorToastAt = useRef(0);
    const toast = useToastStore((s) => s.add);
    const tp = useTParams();
    const setLastSyncError = useReplicaSyncStatusStore((s) => s.setLastError);

    useEffect(() => {
        let cancelled = false;

        const schedule = (delayMs: number, tick: () => Promise<void>) => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
            timerRef.current = window.setTimeout(() => {
                void tick();
            }, delayMs);
        };

        const maybeToastError = (message: string) => {
            const now = Date.now();
            if (now - lastErrorToastAt.current < ERROR_TOAST_COOLDOWN_MS) {
                return;
            }
            lastErrorToastAt.current = now;
            toast(message, "warning");
        };

        const tick = async () => {
            if (cancelled || running.current) {
                schedule(SYNC_INTERVAL_IDLE_MS, tick);
                return;
            }
            running.current = true;
            let nextDelay = SYNC_INTERVAL_IDLE_MS;
            try {
                const snap = await syncGetStatus();
                const isReplica =
                    snap.deployment.mode === "serverless_peer" &&
                    snap.deployment.role === "REPLICA";
                if (!isReplica) {
                    schedule(nextDelay, tick);
                    return;
                }
                if (
                    !snap.deployment.activationToken?.trim() &&
                    !snap.deployment.masterBaseUrl?.trim()
                ) {
                    schedule(nextDelay, tick);
                    return;
                }
                if (!snap.deployment.masterBaseUrl?.trim()) {
                    schedule(nextDelay, tick);
                    return;
                }
                if (snap.pendingOutbox > 0) {
                    nextDelay = SYNC_INTERVAL_ACTIVE_MS;
                }
                const report = await syncRunNow();
                if (report.error) {
                    setLastSyncError(report.error);
                    maybeToastError(tp("replica.sync.background_error", { error: report.error }));
                    nextDelay = SYNC_INTERVAL_ACTIVE_MS;
                } else {
                    setLastSyncError(null);
                }
            } catch (e) {
                const msg = errorMessage(e);
                setLastSyncError(msg);
                maybeToastError(tp("replica.sync.background_error", { error: msg }));
                nextDelay = SYNC_INTERVAL_ACTIVE_MS;
            } finally {
                running.current = false;
                if (!cancelled) {
                    schedule(nextDelay, tick);
                }
            }
        };

        void tick();
        const onOnline = () => void tick();
        window.addEventListener("online", onOnline);

        return () => {
            cancelled = true;
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
            window.removeEventListener("online", onOnline);
        };
    }, [toast, tp, setLastSyncError]);

    return null;
}
