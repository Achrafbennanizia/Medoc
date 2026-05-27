/**
 * Replica setup: scan the LAN for masters, request pairing, wait for accept.
 *
 * Routed when the deployment is `serverless_peer` + role `REPLICA` and
 * no activation token has been persisted yet (`App.tsx` gate).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
    pairingCheckStatus,
    pairingPersistToken,
    pairingScanLan,
    pairingSubmitRequest,
    type DiscoveredMaster,
    type PairingRequestSnapshot,
    type PairingSubmitResult,
} from "@/systems/lan/controllers/pairing-scan.controller";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

type Phase = "scan" | "request" | "waiting" | "accepted" | "rejected";

const POLL_INTERVAL_MS = 2000;

export function PairingScanPage() {
    const toast = useToastStore((s) => s.add);
    const [phase, setPhase] = useState<Phase>("scan");
    const [hits, setHits] = useState<DiscoveredMaster[]>([]);
    const [selected, setSelected] = useState<DiscoveredMaster | null>(null);
    const [label, setLabel] = useState("");
    const [scanBusy, setScanBusy] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [submission, setSubmission] = useState<PairingSubmitResult | null>(null);
    const [snapshot, setSnapshot] = useState<PairingRequestSnapshot | null>(null);
    const pollRef = useRef<number | null>(null);

    const stopPoll = () => {
        if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const scan = useCallback(async () => {
        setScanBusy(true);
        try {
            const masters = await pairingScanLan(2);
            setHits(masters);
            if (masters.length === 0) {
                toast(
                    "Keine Master im LAN gefunden. Sicherstellen, dass medoc-server läuft.",
                    "warning",
                );
            }
        } catch (e) {
            toast(`LAN-Scan: ${errorMessage(e)}`, "error");
        } finally {
            setScanBusy(false);
        }
    }, [toast]);

    useEffect(() => {
        void scan();
        return () => stopPoll();
    }, [scan]);

    const startPolling = useCallback(
        (requestId: string, masterBaseUrl: string) => {
            stopPoll();
            const tick = async () => {
                try {
                    const snap = await pairingCheckStatus({ requestId, masterBaseUrl });
                    setSnapshot(snap);
                    if (snap.status === "ACCEPTED" && snap.activationToken) {
                        stopPoll();
                        try {
                            await pairingPersistToken(snap.activationToken);
                            setPhase("accepted");
                            toast("Pairing akzeptiert — Aktivierungstoken gespeichert.", "success");
                        } catch (e) {
                            toast(`Token speichern: ${errorMessage(e)}`, "error");
                        }
                    } else if (snap.status === "REJECTED" || snap.status === "REVOKED") {
                        stopPoll();
                        setPhase("rejected");
                    }
                } catch (e) {
                    toast(`Status: ${errorMessage(e)}`, "warning");
                }
            };
            void tick();
            pollRef.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
        },
        [toast],
    );

    const submit = async () => {
        if (!selected) {
            toast("Bitte zuerst einen Master auswählen.", "error");
            return;
        }
        if (!label.trim()) {
            toast("Bitte Gerätebezeichnung eingeben.", "error");
            return;
        }
        setSubmitBusy(true);
        try {
            const result = await pairingSubmitRequest({
                masterBaseUrl: selected.baseUrl,
                masterCertSha256: selected.certSha256,
                slaveLabel: label.trim(),
            });
            setSubmission(result);
            setPhase("waiting");
            startPolling(result.requestId, selected.baseUrl);
        } catch (e) {
            toast(`Pairing-Anfrage: ${errorMessage(e)}`, "error");
        } finally {
            setSubmitBusy(false);
        }
    };

    if (phase === "accepted") {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">Pairing erfolgreich</h1>
                <p>
                    Dieses Gerät ist als Replica mit dem Master gekoppelt. Du kannst die App
                    jetzt normal verwenden — Daten werden im Hintergrund synchronisiert.
                </p>
                <p className="card-sub">
                    Aktivierungstoken: <code>{snapshot?.activationToken?.slice(0, 32)}…</code>
                </p>
                <Button type="button" onClick={() => window.location.reload()}>
                    App neu laden
                </Button>
            </main>
        );
    }

    if (phase === "rejected") {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">Pairing abgelehnt</h1>
                <p>
                    Der Master hat die Anfrage abgelehnt oder zurückgezogen. Bitte mit dem
                    Praxis-Administrator klären und Pairing erneut starten.
                </p>
                <Button
                    type="button"
                    onClick={() => {
                        setSnapshot(null);
                        setSubmission(null);
                        setPhase("scan");
                    }}
                >
                    Erneut versuchen
                </Button>
            </main>
        );
    }

    if (phase === "waiting" && submission && selected) {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">Warten auf Master-Bestätigung</h1>
                <p>Auf dem Master akzeptieren: „{selected.label}“ ({selected.baseUrl})</p>
                <p className="card-sub">
                    Slave-DeviceID: <code>{submission.deviceId}</code>
                </p>
                <p className="card-sub">
                    Slave-Pubkey: <code style={{ wordBreak: "break-all" }}>{submission.slavePubkey}</code>
                </p>
                <p className="card-sub">
                    Master-Pubkey:{" "}
                    <code style={{ wordBreak: "break-all" }}>{submission.masterPubkey}</code>
                </p>
                <p className="card-sub">
                    Status: <strong>{snapshot?.status ?? "PENDING"}</strong>
                </p>
                <p className="card-sub">
                    Vergleiche die Fingerabdrücke mit dem Master-Display, bevor du dem
                    Pairing zustimmst (Schutz vor MITM).
                </p>
            </main>
        );
    }

    return (
        <main className="card-pad" style={{ maxWidth: 720, margin: "32px auto" }}>
            <header className="card-head">
                <div>
                    <h1 id="pairing-scan-heading" className="card-title">
                        Replica koppeln
                    </h1>
                    <p className="card-sub">
                        Dieses Gerät läuft im Serverless-Modus. Bitte einen Master im LAN
                        wählen und Pairing-Anfrage stellen. Der Master-Operator akzeptiert die
                        Anfrage in der Einstellungen-Inbox.
                    </p>
                </div>
                <Button type="button" onClick={() => void scan()} disabled={scanBusy} loading={scanBusy}>
                    LAN scannen
                </Button>
            </header>

            <section style={{ marginTop: 12 }}>
                <h2 className="card-sub" style={{ margin: 0 }}>
                    Gefundene Master ({hits.length})
                </h2>
                {hits.length === 0 ? (
                    <p className="card-sub">Keine Treffer — scanne erneut.</p>
                ) : (
                    <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: "none" }}>
                        {hits.map((h) => (
                            <li
                                key={h.instanceId}
                                style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    padding: 12,
                                    marginBottom: 8,
                                    background:
                                        selected?.instanceId === h.instanceId
                                            ? "var(--surface-accent)"
                                            : "transparent",
                                }}
                            >
                                <label
                                    style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "center" }}
                                >
                                    <input
                                        type="radio"
                                        name="master"
                                        checked={selected?.instanceId === h.instanceId}
                                        onChange={() => setSelected(h)}
                                    />
                                    <span style={{ flex: 1 }}>
                                        <strong>{h.label}</strong>
                                        <div className="card-sub">URL: {h.baseUrl}</div>
                                        <div className="card-sub" style={{ wordBreak: "break-all" }}>
                                            TLS-Fingerabdruck:{" "}
                                            <code>{h.certSha256.slice(0, 32)}…</code>
                                        </div>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section style={{ marginTop: 16 }}>
                <Input
                    id="slave-label"
                    label="Gerätebezeichnung"
                    placeholder="z. B. Empfang iPad"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
                <Button
                    type="button"
                    style={{ marginTop: 12 }}
                    loading={submitBusy}
                    disabled={submitBusy || !selected}
                    onClick={() => void submit()}
                >
                    Pairing-Anfrage senden
                </Button>
            </section>
        </main>
    );
}
