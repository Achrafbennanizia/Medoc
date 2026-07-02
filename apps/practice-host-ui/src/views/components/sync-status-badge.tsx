/**
 * Compact replica sync indicator — pending outbox count for serverless peers.
 */

import { useEffect, useState } from "react";

import { useT, useTParams } from "@/lib/i18n";
import { syncGetStatus } from "@/systems/practice-host/controllers/sync.controller";

const POLL_MS = 15_000;

export function SyncStatusBadge() {
    const t = useT();
    const tp = useTParams();
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
                    ? tp("sync.badge.pending_title", { count: pending })
                    : t("sync.badge.up_to_date_title")
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
            {t("sync.badge.label")}{pending > 0 ? tp("sync.badge.pending_short", { count: pending }) : t("sync.badge.ok_short")}
        </span>
    );
}