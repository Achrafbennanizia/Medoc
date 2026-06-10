import { useCallback, useEffect, useState } from "react";
import {
    acknowledgeAuditChainBreak,
    getAuditChainStatus,
    type AuditChainStatus,
} from "@/systems/practice-host/controllers/audit-chain.controller";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "./ui/toast-store";
import { Button } from "./ui/button";
import { DismissibleNotice } from "./ui/dismissible-notice";

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
        <DismissibleNotice
            variant="error"
            role="alert"
            closable={false}
            className="audit-chain-banner"
            title={
                <>
                    Audit-Kette manipuliert
                    {status.broken_at ? ` (Eintrag ${status.broken_at.slice(0, 8)}…)` : ""}
                </>
            }
            subtitle="System- und Backup-Funktionen sind gesperrt, bis ein Administrator die Störung quittiert."
            actions={
                canAcknowledge ? (
                    <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void onAck()}>
                        {busy ? "…" : "Störung quittieren"}
                    </Button>
                ) : undefined
            }
        />
    );
}
