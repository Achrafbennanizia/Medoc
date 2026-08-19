import { useCallback, useEffect, useState } from "react";

import {
    clusterAcceptRequest,
    clusterBlockDevice,
    clusterGetStatus,
    clusterListDevices,
    clusterListPending,
    clusterReclaimDevice,
    clusterRejectRequest,
    clusterRevokeDevice,
    clusterStartListener,
    clusterUnblockDevice,
    type DeviceView,
    type PendingRequest,
} from "@/systems/practice-host/controllers/cluster.controller";
import { useClusterStore } from "@/models/store/cluster-store";
import { useAuthStore } from "@/models/store/auth-store";
import { canAccessClusterAdminPanel } from "@/lib/rbac";
import { CLUSTER_ADMIN_PANEL_V_1_ENABLED } from "@/lib/v1-ui-flags";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";

export function DeviceClusterPanel({ embedded }: { embedded?: boolean }) {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const status = useClusterStore((s) => s.status);
    const setStatus = useClusterStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [pending, setPending] = useState<PendingRequest[]>([]);
    const [devices, setDevices] = useState<DeviceView[]>([]);
    const [sasById, setSasById] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (status != null) return;
        void clusterGetStatus()
            .then(setStatus)
            .catch(() => undefined);
    }, [status, setStatus]);

    const isMemberDevice = !!status?.provisioned && !status.isOwner;

    const allowed =
        CLUSTER_ADMIN_PANEL_V_1_ENABLED &&
        session?.role &&
        canAccessClusterAdminPanel(session.role) &&
        status?.isOwner;

    const reload = useCallback(async () => {
        if (!allowed) return;
        try {
            const [p, d] = await Promise.all([clusterListPending(), clusterListDevices()]);
            setPending(p);
            setDevices(d);
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }, [allowed, toast]);

    useEffect(() => {
        if (!allowed) return;
        void reload();
    }, [allowed, reload]);

    useEffect(() => {
        if (!allowed) return;
        void clusterStartListener().catch(() => undefined);
    }, [allowed]);

    if (isMemberDevice) {
        return (
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="card-title">{t("settings.device_cluster.member_device_title")}</div>
                    <div className="card-sub">{t("settings.device_cluster.member_device_subtitle")}</div>
                </div>
                <div className="settings-row" style={{ alignItems: "flex-start" }}>
                    <div>
                        <b>{t("settings.device_cluster.activate_new_device")}</b>
                        <div className="settings-row-muted">
                            {t("settings.device_cluster.activate_new_device_disabled_hint")}
                        </div>
                    </div>
                    <Button type="button" size="sm" disabled title={t("settings.device_cluster.ca_owner_only")}>
                        {t("settings.device_cluster.activate_new_device")}
                    </Button>
                </div>
                {status?.localFingerprint ? (
                    <p className="card-sub" style={{ marginTop: 8 }}>
                        {t("settings.device_cluster.local_fingerprint")}{" "}
                        <code>{status.localFingerprint}</code>
                    </p>
                ) : null}
            </section>
        );
    }

    if (!allowed) {
        return embedded ? null : (
            <p className="card-sub">{t("settings.device_cluster.admin_only")}</p>
        );
    }

    const usage = status?.seatUsage;

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div className="card-title">{t("settings.device_cluster.title")}</div>
                {usage ? (
                    <div className="card-sub">
                        {tp("settings.device_cluster.usage", {
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

            <h3>{t("settings.device_cluster.pending_title")}</h3>
            {pending.length === 0 ? <p className="card-sub">{t("settings.device_cluster.no_pending")}</p> : null}
            <ul>
                {pending.map((req) => (
                    <li key={req.id}>
                        <strong>{req.fingerprint}</strong>
                        {req.hostname ? ` (${req.hostname})` : null} — {req.requestedRole}
                        {req.suggestedReclaimFingerprint ? (
                            <p className="card-sub">
                                {t("settings.device_cluster.reclaim_hint")}{" "}
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
                                        await clusterReclaimDevice(req.suggestedReclaimFingerprint!);
                                        await reload();
                                        toast(t("settings.device_cluster.reclaim_toast"), "success");
                                    } catch (e) {
                                        toast(errorMessage(e), "error");
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                {t("settings.device_cluster.release_seat")}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                try {
                                    const sas = await clusterAcceptRequest(
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
                            {t("settings.device_cluster.accept")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={async () => {
                                await clusterRejectRequest(req.id);
                                await reload();
                            }}
                        >
                            {t("settings.device_cluster.reject")}
                        </Button>
                        {sasById[req.id] ? (
                            <p>
                                <strong>{t("settings.device_cluster.code_label")}</strong> {sasById[req.id]}
                            </p>
                        ) : null}
                    </li>
                ))}
            </ul>

            <h3>{t("settings.device_cluster.active_devices")}</h3>
            <ul>
                {devices.map((d) => (
                    <li key={d.fingerprint}>
                        {d.fingerprint} · {d.seatRole} · {d.status} · {d.lastIp ?? "—"}
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void clusterRevokeDevice(d.fingerprint).then(reload)}
                        >
                            {t("settings.device_cluster.revoke")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                                void clusterBlockDevice(d.fingerprint, "manuell").then(reload)
                            }
                        >
                            {t("settings.device_cluster.block")}
                        </Button>
                    </li>
                ))}
            </ul>

            <h3>{t("settings.device_cluster.blocklist_title")}</h3>
            <p className="card-sub">{t("settings.device_cluster.blocklist_hint")}</p>
            <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                    const fp = window.prompt(t("settings.device_cluster.unblock_prompt"));
                    if (fp) void clusterUnblockDevice(fp).then(reload);
                }}
            >
                {t("settings.device_cluster.unblock")}
            </Button>
        </section>
    );
}
