import { useCallback, useEffect, useState } from "react";

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

const ACTION_LABELS: Record<string, string> = {
    "sync.push": "Daten zum Master pushen",
    "sync.pull": "Daten vom Master abholen",
    "sync.status": "Sync-Status lesen",
    "pairing.peers": "Peers (Mesh) lesen",
    "patient.read": "Patientenliste lesen (LAN)",
    "termin.read": "Termine lesen (LAN)",
};

const STATUS_LABEL: Record<PairingRequest["status"], string> = {
    PENDING: "Wartet",
    ACCEPTED: "Akzeptiert",
    REJECTED: "Abgelehnt",
    REVOKED: "Widerrufen",
};

const PAIRING_ENABLED_KEY = "pairing.enabled.v1";

export function EinstellungenPairingInbox() {
    const toast = useToastStore((s) => s.add);
    const [items, setItems] = useState<PairingRequest[]>([]);
    const [master, setMaster] = useState<PairingMasterInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [pairingEnabled, setPairingEnabled] = useState(true);
    const [pairingToggleBusy, setPairingToggleBusy] = useState(false);
    const [actionByRow, setActionByRow] = useState<Record<string, Set<string>>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

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
            toast(`Pairing-Inbox: ${errorMessage(e)}`, "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

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
            await pairingDecide(row.id, accept, actions);
            toast(
                accept
                    ? `Replica „${row.slaveLabel || row.deviceId}“ akzeptiert.`
                    : `Replica „${row.slaveLabel || row.deviceId}“ abgelehnt.`,
                "success",
            );
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    const revoke = async (row: PairingRequest) => {
        if (!confirm(`Pairing für „${row.slaveLabel || row.deviceId}“ widerrufen?`)) return;
        setBusyId(row.id);
        try {
            await pairingRevoke(row.deviceId);
            toast(`Pairing widerrufen.`, "success");
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
                pairingEnabled
                    ? "Neue Pairing-Anfragen sind deaktiviert."
                    : "Pairing-Anfragen sind wieder aktiv.",
                "success",
            );
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setPairingToggleBusy(false);
        }
    };

    return (
        <section className="card-pad" aria-labelledby="pairing-inbox-heading">
            <div className="card-head">
                <div>
                    <h2 id="pairing-inbox-heading" className="card-title">
                        Pairing-Inbox (Master)
                    </h2>
                    <p className="card-sub">
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={pairingEnabled}
                                disabled={pairingToggleBusy}
                                onChange={() => void togglePairingEnabled()}
                            />
                            Neue Replica-Anfragen zulassen (pairing.enabled)
                        </label>
                    </p>
                    <p className="card-sub">
                        Replicas im LAN scannen den Master und stellen Anfragen. Akzeptiere
                        Geräte, die zur Praxis gehören, lehne unbekannte ab. Master-Fingerabdruck
                        zum Vergleich auf dem Replica-Bildschirm:
                    </p>
                    {master ? (
                        <p className="card-sub" style={{ marginTop: 4 }}>
                            <strong>Master-DeviceID:</strong> <code>{master.masterDeviceId}</code>
                            <br />
                            <strong>Master-Pubkey (Ed25519):</strong>{" "}
                            <code style={{ wordBreak: "break-all" }}>{master.masterPubkey}</code>
                        </p>
                    ) : (
                        <p className="card-sub" style={{ marginTop: 4 }}>
                            Master-Schlüssel lädt …
                        </p>
                    )}
                </div>
                <Button type="button" onClick={() => void reload()} disabled={loading}>
                    Aktualisieren
                </Button>
            </div>

            {items.length === 0 ? (
                <p className="card-sub" style={{ marginTop: 12 }}>
                    Keine Pairing-Anfragen vorhanden.
                </p>
            ) : (
                <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
                    {items.map((row) => {
                        const selectedActions = actionByRow[row.id] ?? new Set(DEFAULT_ALLOWED_ACTIONS);
                        const isPending = row.status === "PENDING";
                        const isAccepted = row.status === "ACCEPTED";
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
                                        <strong>{row.slaveLabel || "(unbenannt)"}</strong>
                                        <div className="card-sub">
                                            DeviceID: <code>{row.deviceId}</code>
                                        </div>
                                        <div className="card-sub">
                                            IP: <code>{row.requesterIp || "—"}</code> · Status:{" "}
                                            <strong>{STATUS_LABEL[row.status]}</strong>
                                        </div>
                                        <div className="card-sub" style={{ wordBreak: "break-all" }}>
                                            Pubkey: <code>{row.slavePubkey.slice(0, 64)}…</code>
                                        </div>
                                    </div>
                                </div>
                                {isPending ? (
                                    <fieldset
                                        style={{ marginTop: 8, border: "none", padding: 0 }}
                                        aria-label="Erlaubte Aktionen"
                                    >
                                        <legend className="card-sub" style={{ padding: 0 }}>
                                            Erlaubte Aktionen
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
                                                    {ACTION_LABELS[action] ?? action}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                ) : null}
                                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    {isPending ? (
                                        <>
                                            <Button
                                                type="button"
                                                loading={busyId === row.id}
                                                disabled={busyId === row.id || selectedActions.size === 0}
                                                onClick={() => void decide(row, true)}
                                            >
                                                Akzeptieren
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                loading={busyId === row.id}
                                                disabled={busyId === row.id}
                                                onClick={() => void decide(row, false)}
                                            >
                                                Ablehnen
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
                                            Pairing widerrufen
                                        </Button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
