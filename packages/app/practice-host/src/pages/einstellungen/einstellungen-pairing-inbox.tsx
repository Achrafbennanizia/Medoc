import { useCallback, useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";

import {
    DEFAULT_ALLOWED_ACTIONS,
    OPTIONAL_READ_ACTIONS,
    pairingDecide,
    pairingListAll,
    pairingMasterInfo,
    pairingRevoke,
    type PairingMasterInfo,
    type PairingRequest,
} from "@/systems/practice-host/controllers/pairing.controller";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

const PAIRING_ACTION_KEYS: Record<string, string> = {
    "sync.push": "settings.pairing.action.sync_push",
    "sync.pull": "settings.pairing.action.sync_pull",
    "sync.status": "settings.pairing.action.sync_status",
    "pairing.peers": "settings.pairing.action.pairing_peers",
    "patient.read": "settings.pairing.action.patient_read",
    "termin.read": "settings.pairing.action.termin_read",
};

const STATUS_LABEL_KEY: Record<PairingRequest["status"], string> = {
    PENDING: "settings.pairing.status_pending",
    ACCEPTED: "settings.pairing.status_accepted",
    REJECTED: "settings.pairing.status_rejected",
    REVOKED: "settings.pairing.status_revoked",
};

const PAIRING_ENABLED_KEY = "pairing.enabled.v1";

export function EinstellungenPairingInbox({ embedded = false }: { embedded?: boolean } = {}) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [items, setItems] = useState<PairingRequest[]>([]);
    const [master, setMaster] = useState<PairingMasterInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [pairingEnabled, setPairingEnabled] = useState(true);
    const [pairingToggleBusy, setPairingToggleBusy] = useState(false);
    const [actionByRow, setActionByRow] = useState<Record<string, Set<string>>>({});
    const [busyId, setBusyId] = useState<string | null>(null);
    /** PIN shown once on master after accept — replica must enter it. */
    const [confirmPinByRow, setConfirmPinByRow] = useState<Record<string, string>>({});

    const rowLabel = (row: PairingRequest) => row.slaveLabel || row.deviceId;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [list, info, enabledRaw] = await Promise.all([
                pairingListAll(),
                pairingMasterInfo().catch(() => null),
                practiceSystem
                    .invoke<string | null>("get_app_kv", { key: PAIRING_ENABLED_KEY })
                    .catch(() => null),
            ]);
            setPairingEnabled(enabledRaw !== "0" && enabledRaw !== "false");
            setItems(list);
            setMaster(info);
            setActionByRow((prev) => {
                const next: Record<string, Set<string>> = {};
                for (const row of list) {
                    next[row.id] =
                        prev[row.id] ??
                        new Set(
                            row.allowedActions.length > 0
                                ? row.allowedActions
                                : DEFAULT_ALLOWED_ACTIONS,
                        );
                }
                return next;
            });
        } catch (e) {
            toast(tp("settings.pairing.inbox_error", { message: errorMessage(e) }), "error");
        } finally {
            setLoading(false);
        }
    }, [toast, tp]);

    useEffect(() => {
        void reload();
        const id = setInterval(() => void reload(), 5000);
        return () => clearInterval(id);
    }, [reload]);

    const toggleAction = (rowId: string, action: string) => {
        setActionByRow((prev) => {
            const set = new Set(prev[rowId] ?? DEFAULT_ALLOWED_ACTIONS);
            if (set.has(action)) {
                set.delete(action);
            } else {
                set.add(action);
            }
            return { ...prev, [rowId]: set };
        });
    };

    const decide = async (row: PairingRequest, accept: boolean) => {
        setBusyId(row.id);
        try {
            const actions = Array.from(actionByRow[row.id] ?? DEFAULT_ALLOWED_ACTIONS);
            const result = await pairingDecide(row.id, accept, actions);
            const label = rowLabel(row);
            if (accept && result.confirmPin) {
                setConfirmPinByRow((prev) => ({ ...prev, [row.id]: result.confirmPin! }));
                toast(
                    tp("settings.pairing.confirm_pin_toast", { label, pin: result.confirmPin! }),
                    "success",
                );
            } else {
                toast(
                    accept
                        ? tp("settings.pairing.decide_accepted", { label })
                        : tp("settings.pairing.decide_rejected", { label }),
                    "success",
                );
            }
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    const revoke = async (row: PairingRequest) => {
        const label = rowLabel(row);
        if (!confirm(tp("settings.pairing.revoke_confirm", { label }))) return;
        setBusyId(row.id);
        try {
            await pairingRevoke(row.deviceId);
            toast(t("settings.pairing.revoked_toast"), "success");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    const togglePairingEnabled = async () => {
        setPairingToggleBusy(true);
        try {
            const next = pairingEnabled ? "0" : "1";
            await practiceSystem.invoke("set_app_kv", { key: PAIRING_ENABLED_KEY, value: next });
            setPairingEnabled(!pairingEnabled);
            toast(
                pairingEnabled ? t("settings.pairing.toggle_disabled") : t("settings.pairing.toggle_enabled"),
                "success",
            );
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setPairingToggleBusy(false);
        }
    };

    const heading = (
        <>
            <div className="card-title" id={embedded ? undefined : "pairing-inbox-heading"}>
                {t("settings.pairing.inbox_title")}
            </div>
            <p className="card-sub">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                        type="checkbox"
                        checked={pairingEnabled}
                        disabled={pairingToggleBusy}
                        onChange={() => void togglePairingEnabled()}
                    />
                    {t("settings.pairing.allow_checkbox")}
                </label>
            </p>
            <p className="card-sub">{t("settings.pairing.intro")}</p>
            {master ? (
                <p className="card-sub" style={{ marginTop: 4 }}>
                    <strong>{t("settings.pairing.master_device_id")}</strong> <code>{master.masterDeviceId}</code>
                    <br />
                    <strong>{t("settings.pairing.master_pubkey")}</strong>{" "}
                    <code style={{ wordBreak: "break-all" }}>{master.masterPubkey}</code>
                </p>
            ) : (
                <p className="card-sub" style={{ marginTop: 4 }}>
                    {t("settings.pairing.master_keys_loading")}
                </p>
            )}
        </>
    );

    const body = (
        <>
            {items.length === 0 ? (
                <p className="card-sub" style={{ marginTop: 12 }}>
                    {t("settings.pairing.empty")}
                </p>
            ) : (
                <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
                    {items.map((row) => {
                        const selectedActions = actionByRow[row.id] ?? new Set(DEFAULT_ALLOWED_ACTIONS);
                        const isPending = row.status === "PENDING";
                        const isAwaitingPin = isPending && (row.awaitingPin || confirmPinByRow[row.id]);
                        const isAccepted = row.status === "ACCEPTED";
                        const displayedPin = confirmPinByRow[row.id];
                        return (
                            <li
                                key={row.id}
                                style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    padding: 12,
                                    marginBottom: 8,
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <div>
                                        <strong>{row.slaveLabel || t("settings.pairing.unnamed")}</strong>
                                        <div className="card-sub">
                                            {t("settings.pairing.device_id")} <code>{row.deviceId}</code>
                                        </div>
                                        <div className="card-sub">
                                            {t("settings.pairing.ip")} <code>{row.requesterIp || "—"}</code> · {t("settings.pairing.status")}{" "}
                                            <strong>
                                                {isAwaitingPin ? t("settings.pairing.pin_pending") : t(STATUS_LABEL_KEY[row.status])}
                                            </strong>
                                        </div>
                                        {displayedPin ? (
                                            <div
                                                className="card-sub"
                                                style={{
                                                    marginTop: 8,
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    background: "var(--surface-accent)",
                                                    fontSize: "1.25rem",
                                                    letterSpacing: "0.35em",
                                                    fontWeight: 700,
                                                }}
                                                aria-live="polite"
                                            >
                                                {tp("settings.pairing.confirm_code", { pin: displayedPin })}
                                            </div>
                                        ) : null}
                                        <div className="card-sub" style={{ wordBreak: "break-all" }}>
                                            {t("settings.pairing.pubkey")} <code>{row.slavePubkey.slice(0, 64)}…</code>
                                        </div>
                                    </div>
                                </div>
                                {isPending && !isAwaitingPin ? (
                                    <fieldset
                                        style={{ marginTop: 8, border: "none", padding: 0 }}
                                        aria-label={t("settings.pairing.allowed_actions_aria")}
                                    >
                                        <legend className="card-sub" style={{ padding: 0 }}>
                                            {t("settings.pairing.allowed_actions")}
                                        </legend>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: 8,
                                                marginTop: 4,
                                            }}
                                        >
                                            {[...DEFAULT_ALLOWED_ACTIONS, ...OPTIONAL_READ_ACTIONS].map((action) => (
                                                <label
                                                    key={action}
                                                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedActions.has(action)}
                                                        onChange={() => toggleAction(row.id, action)}
                                                    />
                                                    {PAIRING_ACTION_KEYS[action] ? t(PAIRING_ACTION_KEYS[action]) : action}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                ) : isAwaitingPin ? (
                                    <p className="card-sub" style={{ marginTop: 8 }}>
                                        {t("settings.pairing.pin_wait_hint")}
                                    </p>
                                ) : null}
                                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    {isPending && !isAwaitingPin ? (
                                        <>
                                            <Button
                                                type="button"
                                                loading={busyId === row.id}
                                                disabled={busyId === row.id || selectedActions.size === 0}
                                                onClick={() => void decide(row, true)}
                                            >
                                                {t("settings.pairing.accept")}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                loading={busyId === row.id}
                                                disabled={busyId === row.id}
                                                onClick={() => void decide(row, false)}
                                            >
                                                {t("settings.pairing.reject")}
                                            </Button>
                                        </>
                                    ) : null}
                                    {isAccepted ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            loading={busyId === row.id}
                                            disabled={busyId === row.id}
                                            onClick={() => void revoke(row)}
                                        >
                                            {t("settings.pairing.revoke")}
                                        </Button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );

    if (embedded) {
        return (
            <div className="settings-system-block">
                <div className="settings-system-block__head settings-system-block__head--row">
                    <div style={{ flex: 1, minWidth: 0 }}>{heading}</div>
                    <Button type="button" onClick={() => void reload()} disabled={loading}>
                        {t("common.refresh")}
                    </Button>
                </div>
                <div className="settings-system-block__body">{body}</div>
            </div>
        );
    }

    return (
        <section className="card-pad" aria-labelledby="pairing-inbox-heading">
            <div className="card-head">
                <div>{heading}</div>
                <Button type="button" onClick={() => void reload()} disabled={loading}>
                    {t("common.refresh")}
                </Button>
            </div>
            {body}
        </section>
    );
}
