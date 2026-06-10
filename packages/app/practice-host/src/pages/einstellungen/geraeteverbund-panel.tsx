import { useCallback, useEffect, useState } from "react";

import {
    verbundAcceptRequest,
    verbundBlockDevice,
    verbundListDevices,
    verbundListPending,
    verbundReclaimDevice,
    verbundRejectRequest,
    verbundRevokeDevice,
    verbundStartListener,
    verbundUnblockDevice,
    type GeraetView,
    type PendingRequest,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { useAuthStore } from "@/models/store/auth-store";
import { canAccessVerbundAdminPanel } from "@/lib/rbac";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

export function GeraeteverbundPanel({ embedded }: { embedded?: boolean }) {
    const session = useAuthStore((s) => s.session);
    const status = useVerbundStore((s) => s.status);
    const toast = useToastStore((s) => s.add);
    const [pending, setPending] = useState<PendingRequest[]>([]);
    const [devices, setDevices] = useState<GeraetView[]>([]);
    const [sasById, setSasById] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const allowed =
        session?.rolle &&
        canAccessVerbundAdminPanel(session.rolle) &&
        status?.isOwner;

    const reload = useCallback(async () => {
        if (!allowed) return;
        try {
            const [p, d] = await Promise.all([verbundListPending(), verbundListDevices()]);
            setPending(p);
            setDevices(d);
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }, [allowed, toast]);

    useEffect(() => {
        void reload();
        void verbundStartListener().catch(() => undefined);
    }, [reload]);

    if (!allowed) {
        return embedded ? null : (
            <p className="card-sub">Geräteverbund-Administration nur für Ärzte auf einem ADMIN-Sitz.</p>
        );
    }

    const usage = status?.seatUsage;

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div className="card-title">Geräteverbund</div>
                {usage ? (
                    <div className="card-sub">
                        ADMIN {usage.adminUsed}/{usage.maxAdmin} · MEMBER {usage.memberUsed}/{usage.maxMember} ·
                        gesamt {usage.totalUsed}/{usage.maxTotal}
                    </div>
                ) : null}
            </div>

            <h3>Ausstehende Anfragen</h3>
            {pending.length === 0 ? <p className="card-sub">Keine offenen Kopplungsanfragen.</p> : null}
            <ul>
                {pending.map((req) => (
                    <li key={req.id}>
                        <strong>{req.fingerprint}</strong>
                        {req.hostname ? ` (${req.hostname})` : null} — {req.requestedRole}
                        {req.suggestedReclaimFingerprint ? (
                            <p className="card-sub">
                                Vermutliche Neuinstallation — ersetzt Sitz{" "}
                                <code>{req.suggestedReclaimFingerprint}</code>
                            </p>
                        ) : null}
                        {req.suggestedReclaimFingerprint ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={async () => {
                                    setBusy(true);
                                    try {
                                        await verbundReclaimDevice(req.suggestedReclaimFingerprint!);
                                        await reload();
                                        toast("Alter Sitz freigegeben.", "success");
                                    } catch (e) {
                                        toast(errorMessage(e), "error");
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                Sitz freigeben
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                try {
                                    const sas = await verbundAcceptRequest(
                                        req.id,
                                        req.suggestedReclaimFingerprint ?? undefined,
                                    );
                                    setSasById((m) => ({ ...m, [req.id]: sas.digits }));
                                    await reload();
                                } catch (e) {
                                    toast(errorMessage(e), "error");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            Annehmen
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={async () => {
                                await verbundRejectRequest(req.id);
                                await reload();
                            }}
                        >
                            Ablehnen
                        </Button>
                        {sasById[req.id] ? (
                            <p>
                                <strong>4-stelliger Code:</strong> {sasById[req.id]}
                            </p>
                        ) : null}
                    </li>
                ))}
            </ul>

            <h3>Aktive Geräte</h3>
            <ul>
                {devices.map((d) => (
                    <li key={d.fingerprint}>
                        {d.fingerprint} · {d.seatRole} · {d.status} · {d.lastIp ?? "—"}
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void verbundRevokeDevice(d.fingerprint).then(reload)}
                        >
                            Widerrufen
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                                void verbundBlockDevice(d.fingerprint, "manuell").then(reload)
                            }
                        >
                            Sperren
                        </Button>
                    </li>
                ))}
            </ul>

            <h3>Blockliste</h3>
            <p className="card-sub">Gesperrte Fingerprints können hier wieder freigegeben werden (API: unblock).</p>
            <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                    const fp = window.prompt("Fingerprint zum Entsperren:");
                    if (fp) void verbundUnblockDevice(fp).then(reload);
                }}
            >
                Gerät entsperren…
            </Button>
        </section>
    );
}
