/**
 * Compact replica sync indicator — pending outbox count for serverless peers.
 */

import { useEffect, useState } from "react";

import { syncGetStatus } from "@/systems/practice-host/controllers/sync.controller";

const POLL_MS = 15_000;

export function SyncStatusBadge() {
    const [pending, setPending] = useState<number | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            try {
                const snap = await syncGetStatus();
                const isReplica =
                    snap.deployment.mode === "serverless_peer" &&
                    snap.deployment.role === "REPLICA" &&
                    Boolean(snap.deployment.activationToken);
                if (cancelled) return;
                setVisible(isReplica);
                setPending(isReplica ? snap.pendingOutbox : null);
            } catch {
                if (!cancelled) {
                    setVisible(false);
                    setPending(null);
                }
            }
        };

        void tick();
        const id = window.setInterval(() => void tick(), POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, []);

    if (!visible || pending === null) {
        return null;
    }

    const tone =
        pending > 0
            ? { bg: "var(--warning-soft, #fef3c7)", color: "var(--warning-fg, #92400e)" }
            : { bg: "var(--surface-accent)", color: "var(--text-muted)" };

    return (
        <span
            title={
                pending > 0
                    ? `${pending} Änderung(en) warten auf Sync mit dem Master`
                    : "Replica-Sync aktuell"
            }
            style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: tone.bg,
                color: tone.color,
                whiteSpace: "nowrap",
            }}
        >
            Sync{pending > 0 ? `: ${pending} ausstehend` : ": OK"}
        </span>
    );
}
