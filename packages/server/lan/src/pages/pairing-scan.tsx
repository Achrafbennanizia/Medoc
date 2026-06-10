/**
 * Replica setup: scan the LAN for masters, request pairing, wait for accept.
 *
 * Routed when the deployment is `serverless_peer` + role `REPLICA` and
 * no activation token has been persisted yet (`App.tsx` gate).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
    pairingCheckStatus,
    pairingConfirmPin,
    pairingPersistToken,
    pairingScanBluetooth,
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

type Phase = "scan" | "request" | "waiting" | "pin" | "accepted" | "rejected";
type Transport = "lan" | "bluetooth";

const POLL_INTERVAL_MS = 2000;

export function PairingScanPage() {
    const toast = useToastStore((s) => s.add);
    const [phase, setPhase] = useState<Phase>("scan");
    const [transport, setTransport] = useState<Transport>("lan");
    const [hits, setHits] = useState<DiscoveredMaster[]>([]);
    const [selected, setSelected] = useState<DiscoveredMaster | null>(null);
    const [label, setLabel] = useState("");
    const [manualUrl, setManualUrl] = useState("");
    const [manualCert, setManualCert] = useState("");
    const [scanBusy, setScanBusy] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [submission, setSubmission] = useState<PairingSubmitResult | null>(null);
    const [snapshot, setSnapshot] = useState<PairingRequestSnapshot | null>(null);
    const [pinInput, setPinInput] = useState("");
    const [pinBusy, setPinBusy] = useState(false);
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
            const masters =
                transport === "bluetooth"
                    ? await pairingScanBluetooth(3)
                    : await pairingScanLan(2);
            setHits(masters);
            if (masters.length === 0) {
                toast(
                    transport === "bluetooth"
                        ? "Keine Master per Bluetooth gefunden. Master muss im LAN-Modus erreichbar sein."
                        : "Keine Master im LAN gefunden. Sicherstellen, dass medoc-server läuft.",
                    "warning",
                );
            }
        } catch (e) {
            toast(
                `${transport === "bluetooth" ? "Bluetooth" : "LAN"}-Scan: ${errorMessage(e)}`,
                "error",
            );
        } finally {
            setScanBusy(false);
        }
    }, [toast, transport]);

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
                    } else if (snap.awaitingPin) {
                        stopPoll();
                        setPhase("pin");
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

    const submitPin = async () => {
        if (!submission || !selected) return;
        const digits = pinInput.replace(/\D/g, "");
        if (digits.length !== 4) {
            toast("Bitte den 4-stelligen Code vom Master eingeben.", "error");
            return;
        }
        setPinBusy(true);
        try {
            const snap = await pairingConfirmPin({
                requestId: submission.requestId,
                masterBaseUrl: selected.baseUrl,
                pin: digits,
            });
            setSnapshot(snap);
            if (snap.activationToken) {
                await pairingPersistToken(snap.activationToken);
                setPhase("accepted");
                toast("Kopplung abgeschlossen — Aktivierungstoken gespeichert.", "success");
            }
        } catch (e) {
            toast(`Bestätigungscode: ${errorMessage(e)}`, "error");
        } finally {
            setPinBusy(false);
        }
    };

    const submit = async () => {
        const master = selected ?? (manualUrl.trim()
            ? {
                  instanceId: "manual",
                  baseUrl: manualUrl.trim().replace(/\/$/, ""),
                  certSha256: manualCert.trim(),
                  label: manualUrl.trim(),
                  host: "",
                  httpPort: 8787,
                  tls: manualUrl.trim().startsWith("https"),
              }
            : null);
        if (!master) {
            toast("Master-URL eingeben oder aus der Liste wählen.", "warning");
            return;
        }
        if (!label.trim()) {
            toast("Bitte Gerätebezeichnung eingeben.", "error");
            return;
        }
        setSubmitBusy(true);
        try {
            const result = await pairingSubmitRequest({
                masterBaseUrl: master.baseUrl,
                masterCertSha256: master.certSha256,
                slaveLabel: label.trim(),
                transport,
            });
            setSelected(master);
            setSubmission(result);
            setPhase("waiting");
            startPolling(result.requestId, master.baseUrl);
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

    if (phase === "pin" && submission && selected) {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">Bestätigungscode eingeben</h1>
                <p>
                    Der Master hat die Anfrage akzeptiert. Auf dem Master-Gerät wird ein
                    4-stelliger Code angezeigt — hier eingeben, um die Kopplung abzuschließen.
                </p>
                <Input
                    id="pairing-pin"
                    label="Bestätigungscode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    placeholder="0000"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                <Button
                    type="button"
                    style={{ marginTop: 12 }}
                    loading={pinBusy}
                    disabled={pinBusy || pinInput.length !== 4}
                    onClick={() => void submitPin()}
                >
                    Kopplung abschließen
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
                        Master per LAN oder Bluetooth suchen, Pairing-Anfrage senden, auf dem
                        Master akzeptieren lassen und den 4-stelligen Bestätigungscode eingeben.
                    </p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                                type="radio"
                                name="pairing-transport"
                                checked={transport === "lan"}
                                onChange={() => setTransport("lan")}
                            />
                            LAN (UDP)
                        </label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                                type="radio"
                                name="pairing-transport"
                                checked={transport === "bluetooth"}
                                onChange={() => setTransport("bluetooth")}
                            />
                            Bluetooth
                        </label>
                    </div>
                </div>
                <Button type="button" onClick={() => void scan()} disabled={scanBusy} loading={scanBusy}>
                    {transport === "bluetooth" ? "Bluetooth scannen" : "LAN scannen"}
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
                <h2 className="card-sub" style={{ margin: 0 }}>
                    Master-URL manuell (Fallback)
                </h2>
                <p className="card-sub">
                    Wenn der UDP-Scan keinen Treffer liefert, Master-HTTPS-URL einfügen (z. B.{" "}
                    <code>https://192.168.1.10:8787</code>).
                </p>
                <Input
                    id="manual-master-url"
                    label="Master HTTPS-URL"
                    hint="Vom Master-Operator mitteilen lassen — ohne abschließenden Schrägstrich."
                    placeholder="https://192.168.1.10:8787"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                />
                <Input
                    id="manual-master-cert"
                    label="TLS SHA-256 (optional)"
                    hint="Leaf-Zertifikat SHA-256 (hex, ohne Doppelpunkte) zum Abgleich mit dem Master-Display."
                    value={manualCert}
                    onChange={(e) => setManualCert(e.target.value)}
                />
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
                    disabled={submitBusy || (!selected && !manualUrl.trim())}
                    onClick={() => void submit()}
                >
                    Pairing-Anfrage senden
                </Button>
            </section>
        </main>
    );
}
