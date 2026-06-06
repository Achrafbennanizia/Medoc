import { useCallback, useEffect, useState } from "react";
import {
    acknowledgeAuditChainBreak,
    getAuditChainStatus,
    type AuditChainStatus,
} from "@/systems/practice-host/controllers/audit-chain.controller";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "./ui/toast-store";
import { Button } from "./ui/button";

/**
 * Shown when startup verification detected a broken audit hash chain.
 * Blocks `ops.*` backend commands until an admin acknowledges the incident.
 */
export function AuditChainBanner({ canAcknowledge }: { canAcknowledge: boolean }) {
    const toast = useToastStore((s) => s.add);
    const [status, setStatus] = useState<AuditChainStatus | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setStatus(await getAuditChainStatus());
        } catch {
            setStatus(null);
        }
    }, []);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => {
            void load();
        }, 60_000);
        return () => window.clearInterval(id);
    }, [load]);

    if (!status?.blocks_ops) return null;

    const onAck = async () => {
        setBusy(true);
        try {
            await acknowledgeAuditChainBreak();
            toast("Betriebs-Sperre aufgehoben (Freigabe protokolliert)", "success");
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            role="alert"
            className="audit-chain-banner"
            style={{
                flexShrink: 0,
                padding: "10px 16px",
                background: "color-mix(in oklab, var(--red) 18%, var(--bg-elev))",
                borderBottom: "1px solid color-mix(in oklab, var(--red) 45%, var(--line))",
                color: "var(--fg)",
                fontSize: 13,
                lineHeight: 1.4,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <div style={{ fontWeight: 600 }}>
                Audit-Kette manipuliert
                {status.broken_at ? ` (Eintrag ${status.broken_at.slice(0, 8)}…)` : ""}
                — System- und Backup-Funktionen sind gesperrt, bis ein Administrator die Störung
                quittiert.
            </div>
            {canAcknowledge ? (
                <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void onAck()}>
                    {busy ? "…" : "Störung quittieren"}
                </Button>
            ) : null}
        </div>
    );
}
