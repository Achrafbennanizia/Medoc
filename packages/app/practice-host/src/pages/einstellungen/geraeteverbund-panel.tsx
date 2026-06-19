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
import { useT, useTParams } from "@/lib/i18n";

export function GeraeteverbundPanel({ embedded }: { embedded?: boolean }) {
    const t = useT();
    const tp = useTParams();
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
            <p className="card-sub">{t("settings.geraeteverbund.admin_only")}</p>
        );
    }

    const usage = status?.seatUsage;

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div className="card-title">{t("settings.geraeteverbund.title")}</div>
                {usage ? (
                    <div className="card-sub">
                        {tp("settings.geraeteverbund.usage", {
                            adminUsed: usage.adminUsed,
                            maxAdmin: usage.maxAdmin,
                            memberUsed: usage.memberUsed,
                            maxMember: usage.maxMember,
                            totalUsed: usage.totalUsed,
                            maxTotal: usage.maxTotal,
                        })}
                    </div>
                ) : null}
            </div>

            <h3>{t("settings.geraeteverbund.pending_title")}</h3>
            {pending.length === 0 ? <p className="card-sub">{t("settings.geraeteverbund.no_pending")}</p> : null}
            <ul>
                {pending.map((req) => (
                    <li key={req.id}>
                        <strong>{req.fingerprint}</strong>
                        {req.hostname ? ` (${req.hostname})` : null} — {req.requestedRole}
                        {req.suggestedReclaimFingerprint ? (
                            <p className="card-sub">
                                {t("settings.geraeteverbund.reclaim_hint")}{" "}
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
                                        toast(t("settings.geraeteverbund.reclaim_toast"), "success");
                                    } catch (e) {
                                        toast(errorMessage(e), "error");
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                {t("settings.geraeteverbund.release_seat")}
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
                            {t("settings.geraeteverbund.accept")}
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
                            {t("settings.geraeteverbund.reject")}
                        </Button>
                        {sasById[req.id] ? (
                            <p>
                                <strong>{t("settings.geraeteverbund.code_label")}</strong> {sasById[req.id]}
                            </p>
                        ) : null}
                    </li>
                ))}
            </ul>

            <h3>{t("settings.geraeteverbund.active_devices")}</h3>
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
                            {t("settings.geraeteverbund.revoke")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                                void verbundBlockDevice(d.fingerprint, "manuell").then(reload)
                            }
                        >
                            {t("settings.geraeteverbund.block")}
                        </Button>
                    </li>
                ))}
            </ul>

            <h3>{t("settings.geraeteverbund.blocklist_title")}</h3>
            <p className="card-sub">{t("settings.geraeteverbund.blocklist_hint")}</p>
            <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                    const fp = window.prompt(t("settings.geraeteverbund.unblock_prompt"));
                    if (fp) void verbundUnblockDevice(fp).then(reload);
                }}
            >
                {t("settings.geraeteverbund.unblock")}
            </Button>
        </section>
    );
}
