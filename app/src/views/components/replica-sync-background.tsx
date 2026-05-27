/**
 * Background replica sync — adaptive interval (5s when outbox pending, 30s idle).
 */

import { useEffect, useRef } from "react";

import { syncGetStatus, syncRunNow } from "@/systems/practice-host/controllers/sync.controller";

const SYNC_INTERVAL_IDLE_MS = 30_000;
const SYNC_INTERVAL_ACTIVE_MS = 5_000;

export function ReplicaSyncBackground() {
    const running = useRef(false);
    const timerRef = useRef<number | null>(null);

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
                if (!isReplica || !snap.deployment.activationToken) {
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
                await syncRunNow();
            } catch {
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
    }, []);

    return null;
}
