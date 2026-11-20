import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useT, useTParams, type Locale } from "@/lib/i18n";

import {
    clusterAcceptRequest,
    clusterRejectRequest,
} from "@/systems/practice-host/controllers/cluster.controller";
import {
    DEFAULT_ALLOWED_ACTIONS,
    OPTIONAL_READ_ACTIONS,
    pairingDecide,
    pairingListAll,
    pairingListPending,
    pairingMasterInfo,
    pairingRevoke,
    type PairingMasterInfo,
    type PairingRequest,
} from "@/systems/practice-host/controllers/pairing.controller";
import { getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { Button } from "@/views/components/ui/button";
import { ConfirmDialog } from "@/views/components/ui/dialog";
import { errorMessage, formatDateTime, parseDbUtc } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

const PAIRING_ACTION_KEYS: Record<string, string> = {
    "sync.push": "settings.pairing.action.sync_push",
    "sync.pull": "settings.pairing.action.sync_pull",
    "sync.status": "settings.pairing.action.sync_status",
    "pairing.peers": "settings.pairing.action.pairing_peers",
    "patient.read": "settings.pairing.action.patient_read",
    "appointment.read": "settings.pairing.action.appointment_read",
};

const STATUS_LABEL_KEY: Record<PairingRequest["status"], string> = {
    PENDING: "settings.pairing.status_pending",
    ACCEPTED: "settings.pairing.status_accepted",
    REJECTED: "settings.pairing.status_rejected",
    REVOKED: "settings.pairing.status_revoked",
};

const PAIRING_ENABLED_KEY = "pairing.enabled.v1";
const PREVIEW_COUNT = 2;

type RowAction = "accept" | "reject" | "revoke";

type CardTone = "pending" | "pin" | "accepted" | "rejected" | "revoked";

const TONE_RANK: Record<CardTone, number> = {
    pending: 0,
    pin: 1,
    accepted: 2,
    rejected: 3,
    revoked: 4,
};

const PILL_CLASS: Record<CardTone, string> = {
    pending: "orange",
    pin: "blue",
    accepted: "green",
    rejected: "red",
    revoked: "grey",
};

function displayIp(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const mapped = trimmed.toLowerCase().startsWith("::ffff:") ? trimmed.slice("::ffff:".length) : trimmed;
    if (mapped === "0.0.0.0" || mapped === "::" || mapped === "::0") return "";
    return mapped;
}

function requestedLabel(value: string, locale: Locale): string | null {
    if (!value) return null;
    const date = parseDbUtc(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateTime(value, locale);
}

function actionsOf(row: PairingRequest): string[] {
    return Array.isArray(row.allowedActions) ? row.allowedActions : [];
}

/** Pending coupling rows win so a slow full-list response cannot hide a new request. */
function mergeInbox(all: PairingRequest[], pending: PairingRequest[]): PairingRequest[] {
    const byId = new Map<string, PairingRequest>();
    for (const row of all) {
        if (row?.id) byId.set(row.id, row);
    }
    for (const row of pending) {
        if (!row?.id) continue;
        const prev = byId.get(row.id);
        if (!prev) {
            byId.set(row.id, { ...row, status: "PENDING" });
            continue;
        }
        byId.set(row.id, {
            ...row,
            ...prev,
            requesterIp: prev.requesterIp?.trim() ? prev.requesterIp : row.requesterIp,
            slaveLabel: prev.slaveLabel?.trim() ? prev.slaveLabel : row.slaveLabel,
            couplingCode: row.couplingCode ?? prev.couplingCode,
            status: "PENDING",
        });
    }
    return [...byId.values()];
}

function cardTone(row: PairingRequest, awaitingPin: boolean): CardTone {
    if (awaitingPin) return "pin";
    if (row.status === "PENDING") return "pending";
    if (row.status === "ACCEPTED") return "accepted";
    if (row.status === "REJECTED") return "rejected";
    return "revoked";
}

function CopyIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SettingsPairingInbox({ embedded = false }: { embedded?: boolean } = {}) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const toast = useToastStore((s) => s.add);
    const [items, setItems] = useState<PairingRequest[]>([]);
    const [master, setMaster] = useState<PairingMasterInfo | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [pairingEnabled, setPairingEnabled] = useState(true);
    const [pairingToggleBusy, setPairingToggleBusy] = useState(false);
    const [actionByRow, setActionByRow] = useState<Record<string, Set<string>>>({});
    const [busy, setBusy] = useState<{ id: string; action: RowAction } | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<PairingRequest | null>(null);
    /** PIN shown once on master after accept — replica must enter it. */
    const [confirmPinByRow, setConfirmPinByRow] = useState<Record<string, string>>({});
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [listExpanded, setListExpanded] = useState(false);
    const lastError = useRef<string | null>(null);
    const reloadSeq = useRef(0);

    const deviceName = (row: PairingRequest) => {
        const label = (row.slaveLabel ?? "").trim();
        const id = (row.deviceId ?? "").trim();
        return label && label !== id ? label : "";
    };
    const rowLabel = (row: PairingRequest) => deviceName(row) || (row.deviceId ?? "").trim();

    const reload = useCallback(async (mode: "initial" | "manual" | "poll" = "manual") => {
        const seq = ++reloadSeq.current;
        if (mode !== "poll") setRefreshing(true);
        try {
            const [allResult, pendingResult, info, enabledRaw] = await Promise.all([
                pairingListAll().then(
                    (rows) => ({ ok: true as const, rows }),
                    (error: unknown) => ({ ok: false as const, error }),
                ),
                pairingListPending().then(
                    (rows) => ({ ok: true as const, rows }),
                    (error: unknown) => ({ ok: false as const, error }),
                ),
                pairingMasterInfo().catch(() => null),
                getAppKvRaw(PAIRING_ENABLED_KEY).catch(() => null),
            ]);
            if (seq !== reloadSeq.current) return;
            if (!allResult.ok && !pendingResult.ok) {
                throw allResult.error;
            }
            const list = mergeInbox(
                allResult.ok ? allResult.rows : [],
                pendingResult.ok ? pendingResult.rows : [],
            );
            setPairingEnabled(enabledRaw !== "0" && enabledRaw !== "false");
            setItems(list);
            setConfirmPinByRow((prev) => {
                const ids = new Set(list.map((row) => row.id));
                const next: Record<string, string> = {};
                for (const [id, pin] of Object.entries(prev)) {
                    if (ids.has(id)) next[id] = pin;
                }
                return next;
            });
            setMaster(info);
            setActionByRow((prev) => {
                const next: Record<string, Set<string>> = {};
                for (const row of list) {
                    const actions = actionsOf(row);
                    next[row.id] =
                        prev[row.id] ??
                        new Set(actions.length > 0 ? actions : DEFAULT_ALLOWED_ACTIONS);
                }
                return next;
            });
            lastError.current = null;
            setLoadError(null);
            setLoaded(true);
        } catch (e) {
            if (seq !== reloadSeq.current) return;
            const message = errorMessage(e);
            setLoadError(message);
            if (mode !== "poll" || lastError.current !== message) {
                lastError.current = message;
                toast(tp("settings.pairing.inbox_error", { message }), "error");
            }
            setLoaded(true);
        } finally {
            if (mode !== "poll") setRefreshing(false);
        }
    }, [toast, tp]);

    useEffect(() => {
        void reload("initial");
        const id = window.setInterval(() => void reload("poll"), 3000);
        const refreshIfVisible = () => {
            if (document.visibilityState === "visible") void reload("poll");
        };
        window.addEventListener("focus", refreshIfVisible);
        document.addEventListener("visibilitychange", refreshIfVisible);
        return () => {
            window.clearInterval(id);
            window.removeEventListener("focus", refreshIfVisible);
            document.removeEventListener("visibilitychange", refreshIfVisible);
        };
    }, [reload]);

    useEffect(() => {
        if (!copiedKey) return;
        const id = window.setTimeout(() => setCopiedKey(null), 1600);
        return () => window.clearTimeout(id);
    }, [copiedKey]);

    const copyValue = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            toast(t("common.copied"), "success");
        } catch (e) {
            toast(tp("common.copy_failed", { message: errorMessage(e) }), "error");
        }
    };

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
        setBusy({ id: row.id, action: accept ? "accept" : "reject" });
        try {
            const label = rowLabel(row);
            if (row.clusterSas) {
                if (accept) {
                    const sas = await clusterAcceptRequest(row.id);
                    setConfirmPinByRow((prev) => ({ ...prev, [row.id]: sas.digits }));
                    toast(
                        tp("settings.pairing.confirm_pin_toast", { label, pin: sas.digits }),
                        "success",
                    );
                } else {
                    await clusterRejectRequest(row.id);
                    toast(tp("settings.pairing.decide_rejected", { label }), "success");
                }
                await reload("manual");
                return;
            }
            const actions = Array.from(actionByRow[row.id] ?? DEFAULT_ALLOWED_ACTIONS);
            const result = await pairingDecide(row.id, accept, actions);
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
            await reload("manual");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(null);
        }
    };

    const revoke = async (row: PairingRequest) => {
        const key = (row.deviceId ?? "").trim() || row.id;
        setBusy({ id: row.id, action: "revoke" });
        try {
            await pairingRevoke(key);
            toast(t("settings.pairing.revoked_toast"), "success");
            setRevokeTarget(null);
            await reload("manual");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(null);
        }
    };

    const togglePairingEnabled = async () => {
        setPairingToggleBusy(true);
        try {
            const next = pairingEnabled ? "0" : "1";
            await setAppKvRaw(PAIRING_ENABLED_KEY, next);
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

    const pendingCount = items.filter((row) => row.status === "PENDING").length;
    const ordered = [...items].sort((a, b) => {
        const toneA = cardTone(a, a.status === "PENDING" && (Boolean(a.awaitingPin) || Boolean(confirmPinByRow[a.id])));
        const toneB = cardTone(b, b.status === "PENDING" && (Boolean(b.awaitingPin) || Boolean(confirmPinByRow[b.id])));
        if (TONE_RANK[toneA] !== TONE_RANK[toneB]) return TONE_RANK[toneA] - TONE_RANK[toneB];
        return (b.requestedAt || "").localeCompare(a.requestedAt || "");
    });
    const visible = listExpanded ? ordered : ordered.slice(0, PREVIEW_COUNT);
    const hiddenCount = Math.max(0, ordered.length - PREVIEW_COUNT);

    const copyButton = (key: string, value: string, label = t("common.copy")) => (
        <button
            type="button"
            className="pairing-inbox__icon-btn"
            aria-label={copiedKey === key ? t("common.copied") : label}
            onClick={() => void copyValue(key, value)}
        >
            {copiedKey === key ? <CheckIcon /> : <CopyIcon />}
        </button>
    );

    const heading = (
        <div className="pairing-inbox__heading">
            <div className="pairing-inbox__title-row">
                <div className="card-title pairing-inbox__title" id={embedded ? undefined : "pairing-inbox-heading"}>
                    {t("settings.pairing.inbox_title")}
                </div>
                {pendingCount > 0 ? (
                    <span className="pill orange pairing-inbox__count">
                        <span className="dot" aria-hidden="true" />
                        <span className="pairing-inbox__count-num">{pendingCount}</span>
                        {t("settings.pairing.status_pending")}
                    </span>
                ) : null}
            </div>
            <p className="card-sub pairing-inbox__intro">{t("settings.pairing.intro")}</p>
        </div>
    );

    const body = (
        <>
            <div className={`pairing-inbox__toggle${pairingEnabled ? "" : " pairing-inbox__toggle--off"}`}>
                <p className="pairing-inbox__toggle-label">{t("settings.pairing.allow_checkbox")}</p>
                <SettingsSwitch
                    ariaLabel={t("settings.pairing.allow_checkbox")}
                    checked={pairingEnabled}
                    disabled={pairingToggleBusy}
                    onChange={() => void togglePairingEnabled()}
                />
            </div>

            <div className="pairing-inbox__identity" aria-busy={master == null}>
                {master ? (
                    <>
                        <div className="pairing-inbox__kv">
                            <div className="pairing-inbox__k">{t("settings.pairing.master_device_id")}</div>
                            <div className="pairing-inbox__v">
                                <code className="pairing-inbox__mono" title={master.masterDeviceId}>
                                    {master.masterDeviceId}
                                </code>
                                {copyButton("master-id", master.masterDeviceId)}
                            </div>
                        </div>
                        <div className="pairing-inbox__kv">
                            <div className="pairing-inbox__k">{t("settings.pairing.master_pubkey")}</div>
                            <div className="pairing-inbox__v">
                                <code className="pairing-inbox__mono pairing-inbox__mono--wrap" title={master.masterPubkey}>
                                    {master.masterPubkey}
                                </code>
                                {copyButton("master-key", master.masterPubkey)}
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="card-sub">{t("settings.pairing.master_keys_loading")}</p>
                )}
            </div>

            {!loaded ? (
                <div className="pairing-inbox__skeleton" aria-busy="true" aria-live="polite">
                    <span className="sr-only">{t("common.loading")}</span>
                    <span />
                    <span />
                </div>
            ) : ordered.length === 0 ? (
                <p className="pairing-inbox__empty">
                    {loadError
                        ? tp("settings.pairing.inbox_error", { message: loadError })
                        : t("settings.pairing.empty")}
                </p>
            ) : (
                <ul className="pairing-inbox__list">
                    {visible.map((row) => {
                        const selectedActions = actionByRow[row.id] ?? new Set(DEFAULT_ALLOWED_ACTIONS);
                        const isPending = row.status === "PENDING";
                        const isAwaitingPin = isPending && (Boolean(row.awaitingPin) || Boolean(confirmPinByRow[row.id]));
                        const isAccepted = row.status === "ACCEPTED";
                        const displayedPin = confirmPinByRow[row.id] || row.couplingCode || undefined;
                        const when = requestedLabel(row.requestedAt, locale);
                        const rowBusy = busy?.id === row.id;
                        const codeReady = isPending && Boolean(displayedPin) && !isAwaitingPin;
                        const statusLabel = isAwaitingPin
                            ? t("settings.pairing.pin_pending")
                            : codeReady
                              ? t("settings.pairing.status_confirm")
                              : t(STATUS_LABEL_KEY[row.status]);
                        const tone = cardTone(row, isAwaitingPin || codeReady);
                        const name = deviceName(row);
                        return (
                            <li key={row.id} className={`pairing-inbox__card pairing-inbox__card--${tone}`}>
                                <div className="pairing-inbox__card-head">
                                    <div className="pairing-inbox__who">
                                        <strong className="pairing-inbox__name">
                                            {name || t("settings.pairing.unnamed")}
                                        </strong>
                                        {when ? (
                                            <div className="pairing-inbox__when">
                                                {tp("settings.pairing.requested", { when })}
                                            </div>
                                        ) : null}
                                    </div>
                                    <span className={`pill ${PILL_CLASS[tone]}`}>
                                        <span className="dot" aria-hidden="true" />
                                        {statusLabel}
                                    </span>
                                </div>
                                <div className="pairing-inbox__meta">
                                    <div className="pairing-inbox__kv pairing-inbox__kv--inline">
                                        <div className="pairing-inbox__k">{t("settings.pairing.device_id")}</div>
                                        <div className="pairing-inbox__v">
                                            <code className="pairing-inbox__mono pairing-inbox__mono--wrap">{row.deviceId}</code>
                                            {copyButton(
                                                `device-${row.id}`,
                                                row.deviceId,
                                                `${t("common.copy")} ${t("settings.pairing.device_id")}`,
                                            )}
                                        </div>
                                    </div>
                                    <div className="pairing-inbox__kv pairing-inbox__kv--inline">
                                        <div className="pairing-inbox__k">{t("settings.pairing.ip")}</div>
                                        <div className="pairing-inbox__v">
                                            <code className="pairing-inbox__mono pairing-inbox__mono--wrap">
                                                {displayIp(row.requesterIp ?? "") || "—"}
                                            </code>
                                        </div>
                                    </div>
                                    <div className="pairing-inbox__kv pairing-inbox__kv--inline">
                                        <div className="pairing-inbox__k">{t("settings.pairing.pubkey")}</div>
                                        <div className="pairing-inbox__v">
                                            <code className="pairing-inbox__mono pairing-inbox__mono--wrap">
                                                {(row.slavePubkey ?? "").trim() || "—"}
                                            </code>
                                            {(row.slavePubkey ?? "").trim()
                                                ? copyButton(
                                                      `key-${row.id}`,
                                                      row.slavePubkey,
                                                      `${t("common.copy")} ${t("settings.pairing.pubkey")}`,
                                                  )
                                                : null}
                                        </div>
                                    </div>
                                </div>

                                {displayedPin ? (
                                    <div
                                        className="pairing-inbox__pin"
                                        aria-label={tp("settings.pairing.confirm_code", { pin: displayedPin })}
                                    >
                                        <div className="pairing-inbox__pin-label">
                                            {t("settings.pairing.confirm_code_label")}
                                        </div>
                                        <div
                                            className="pairing-inbox__pin-digits"
                                            data-arabic-numerals-skip=""
                                            dir="ltr"
                                            aria-live="polite"
                                        >
                                            {displayedPin.split("").map((digit, index) => (
                                                <span key={`${row.id}-${index}`}>{digit}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {isPending && !isAwaitingPin ? (
                                    <fieldset className="pairing-inbox__actions" aria-label={t("settings.pairing.allowed_actions_aria")}>
                                        <legend>{t("settings.pairing.allowed_actions")}</legend>
                                        <div className="pairing-inbox__chips">
                                            {[...DEFAULT_ALLOWED_ACTIONS, ...OPTIONAL_READ_ACTIONS].map((action) => {
                                                const on = selectedActions.has(action);
                                                return (
                                                    <button
                                                        key={action}
                                                        type="button"
                                                        role="checkbox"
                                                        aria-checked={on}
                                                        className={`pairing-inbox__chip${on ? " pairing-inbox__chip--on" : ""}`}
                                                        onClick={() => toggleAction(row.id, action)}
                                                    >
                                                        {PAIRING_ACTION_KEYS[action] ? t(PAIRING_ACTION_KEYS[action]) : action}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </fieldset>
                                ) : isAwaitingPin ? (
                                    <p className="card-sub pairing-inbox__hint">{t("settings.pairing.pin_wait_hint")}</p>
                                ) : null}

                                {isPending && !isAwaitingPin ? (
                                    <div className="pairing-inbox__footer">
                                        <Button
                                            type="button"
                                            loading={rowBusy && busy?.action === "accept"}
                                            disabled={rowBusy || selectedActions.size === 0}
                                            onClick={() => void decide(row, true)}
                                        >
                                            {t("settings.pairing.accept")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            loading={rowBusy && busy?.action === "reject"}
                                            disabled={rowBusy}
                                            onClick={() => void decide(row, false)}
                                        >
                                            {t("settings.pairing.reject")}
                                        </Button>
                                    </div>
                                ) : null}
                                {isAccepted ? (
                                    <div className="pairing-inbox__footer">
                                        <Button
                                            type="button"
                                            variant="danger"
                                            loading={rowBusy && busy?.action === "revoke"}
                                            disabled={rowBusy}
                                            onClick={() => setRevokeTarget(row)}
                                        >
                                            {t("settings.pairing.revoke")}
                                        </Button>
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}
            {hiddenCount > 0 ? (
                <button
                    type="button"
                    className="pairing-inbox__more"
                    aria-expanded={listExpanded}
                    onClick={() => setListExpanded((open) => !open)}
                >
                    {listExpanded
                        ? t("settings.pairing.show_less")
                        : tp("settings.pairing.show_more", { count: hiddenCount })}
                </button>
            ) : null}
            <ConfirmDialog
                open={revokeTarget != null}
                danger
                title={t("settings.pairing.revoke")}
                message={
                    revokeTarget
                        ? tp("settings.pairing.revoke_confirm", { label: rowLabel(revokeTarget) })
                        : ""
                }
                confirmLabel={t("settings.pairing.revoke")}
                loading={busy?.action === "revoke"}
                onClose={() => {
                    if (busy?.action !== "revoke") setRevokeTarget(null);
                }}
                onConfirm={() => {
                    if (revokeTarget) void revoke(revokeTarget);
                }}
            />
        </>
    );

    const refresh = (
        <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pairing-inbox__refresh"
            loading={refreshing}
            disabled={refreshing}
            onClick={() => void reload("manual")}
        >
            {t("common.refresh")}
        </Button>
    );

    if (embedded) {
        return (
            <div className="settings-system-block pairing-inbox">
                <div className="settings-system-block__head settings-system-block__head--row">
                    {heading}
                    {refresh}
                </div>
                <div className="settings-system-block__body">{body}</div>
            </div>
        );
    }

    return (
        <section className="card-pad pairing-inbox" aria-labelledby="pairing-inbox-heading">
            <div className="card-head">
                {heading}
                {refresh}
            </div>
            {body}
        </section>
    );
}
