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
import { errorMessage, formatTpl } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT } from "@/lib/i18n";

type Phase = "scan" | "request" | "waiting" | "pin" | "accepted" | "rejected";
type Transport = "lan" | "bluetooth";

const POLL_INTERVAL_MS = 2000;

export function PairingScanPage() {
    const toast = useToastStore((s) => s.add);
    const t = useT();
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

    const transportLabel = transport === "bluetooth" ? "Bluetooth" : "LAN";

    const stopPoll = () => {
        if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const resetPairing = () => {
        stopPoll();
        setPhase("scan");
        setSubmission(null);
        setSnapshot(null);
        setSelected(null);
        setPinInput("");
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
                        ? t("page.lan.pairing_scan.toast.no_master_bt")
                        : t("page.lan.pairing_scan.toast.no_master_lan"),
                    "warning",
                );
            }
        } catch (e) {
            toast(
                formatTpl(t("page.lan.pairing_scan.toast.scan_err"), {
                    transport: transportLabel,
                    error: errorMessage(e),
                }),
                "error",
            );
        } finally {
            setScanBusy(false);
        }
    }, [toast, t, transport, transportLabel]);

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
                            toast(t("page.lan.pairing_scan.toast.accepted"), "success");
                        } catch (e) {
                            toast(
                                formatTpl(t("page.lan.pairing_scan.toast.save_token_err"), {
                                    error: errorMessage(e),
                                }),
                                "error",
                            );
                        }
                    } else if (snap.awaitingPin) {
                        stopPoll();
                        setPhase("pin");
                    } else if (snap.status === "REJECTED" || snap.status === "REVOKED") {
                        stopPoll();
                        setPhase("rejected");
                    }
                } catch (e) {
                    toast(
                        formatTpl(t("page.lan.pairing_scan.toast.status_err"), { error: errorMessage(e) }),
                        "warning",
                    );
                }
            };
            void tick();
            pollRef.current = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
        },
        [toast, t],
    );

    const submitPin = async () => {
        if (!submission || !selected) return;
        const digits = pinInput.replace(/\D/g, "");
        if (digits.length !== 4) {
            toast(t("page.lan.pairing_scan.toast.pin_required"), "error");
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
                toast(t("page.lan.pairing_scan.toast.complete"), "success");
            }
        } catch (e) {
            toast(
                formatTpl(t("page.lan.pairing_scan.toast.confirm_err"), { error: errorMessage(e) }),
                "error",
            );
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
            toast(t("page.lan.pairing_scan.toast.select_master"), "warning");
            return;
        }
        if (!label.trim()) {
            toast(t("page.lan.pairing_scan.toast.device_label_required"), "error");
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
            toast(
                formatTpl(t("page.lan.pairing_scan.toast.submit_err"), { error: errorMessage(e) }),
                "error",
            );
        } finally {
            setSubmitBusy(false);
        }
    };

    if (phase === "accepted") {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">{t("page.lan.pairing_scan.title.accepted")}</h1>
                <p>{t("page.lan.pairing_scan.body.accepted")}</p>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.activation_token")}{" "}
                    <code>{snapshot?.activationToken?.slice(0, 32)}…</code>
                </p>
                <Button type="button" onClick={() => window.location.reload()}>
                    {t("page.lan.pairing_scan.reload")}
                </Button>
            </main>
        );
    }

    if (phase === "rejected") {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">{t("page.lan.pairing_scan.title.rejected")}</h1>
                <p>{t("page.lan.pairing_scan.body.rejected")}</p>
                <Button
                    type="button"
                    onClick={() => {
                        setSnapshot(null);
                        setSubmission(null);
                        setPhase("scan");
                    }}
                >
                    {t("page.lan.pairing_scan.retry")}
                </Button>
            </main>
        );
    }

    if (phase === "pin" && submission && selected) {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">{t("page.lan.pairing_scan.title.pin")}</h1>
                <p>{t("page.lan.pairing_scan.body.pin")}</p>
                <Input
                    id="pairing-pin"
                    label={t("page.lan.pairing_scan.label.pin")}
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
                    {t("page.lan.pairing_scan.finish")}
                </Button>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                    <Button type="button" variant="ghost" onClick={resetPairing}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </main>
        );
    }

    if (phase === "waiting" && submission && selected) {
        return (
            <main className="card-pad" style={{ maxWidth: 640, margin: "32px auto" }}>
                <h1 className="card-title">{t("page.lan.pairing_scan.title.waiting")}</h1>
                <p>
                    {formatTpl(t("page.lan.pairing_scan.waiting_accept"), {
                        label: selected.label,
                        url: selected.baseUrl,
                    })}
                </p>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.slave_device_id")} <code>{submission.deviceId}</code>
                </p>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.slave_pubkey")}{" "}
                    <code style={{ wordBreak: "break-all" }}>{submission.slavePubkey}</code>
                </p>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.master_pubkey")}{" "}
                    <code style={{ wordBreak: "break-all" }}>{submission.masterPubkey}</code>
                </p>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.status")} <strong>{snapshot?.status ?? "PENDING"}</strong>
                </p>
                <p className="card-sub">{t("page.lan.pairing_scan.mitm_hint")}</p>
                <div className="row" style={{ gap: 8, marginTop: 16 }}>
                    <Button type="button" variant="ghost" onClick={resetPairing}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="card-pad" style={{ maxWidth: 720, margin: "32px auto" }}>
            <header className="card-head">
                <div>
                    <h1 id="pairing-scan-heading" className="card-title">
                        {t("page.lan.pairing_scan.title")}
                    </h1>
                    <p className="card-sub">{t("page.lan.pairing_scan.subtitle")}</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                                type="radio"
                                name="pairing-transport"
                                checked={transport === "lan"}
                                onChange={() => setTransport("lan")}
                            />
                            {t("page.lan.pairing_scan.transport.lan")}
                        </label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                                type="radio"
                                name="pairing-transport"
                                checked={transport === "bluetooth"}
                                onChange={() => setTransport("bluetooth")}
                            />
                            {t("page.lan.pairing_scan.transport.bluetooth")}
                        </label>
                    </div>
                </div>
                <Button type="button" onClick={() => void scan()} disabled={scanBusy} loading={scanBusy}>
                    {transport === "bluetooth"
                        ? t("page.lan.pairing_scan.scan_bluetooth")
                        : t("page.lan.pairing_scan.scan_lan")}
                </Button>
            </header>

            <section style={{ marginTop: 12 }}>
                <h2 className="card-sub" style={{ margin: 0 }}>
                    {formatTpl(t("page.lan.pairing_scan.found_masters"), { count: hits.length })}
                </h2>
                {hits.length === 0 ? (
                    <p className="card-sub">{t("page.lan.pairing_scan.no_hits")}</p>
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
                                        <div className="card-sub">
                                            {t("page.lan.pairing_scan.url")} {h.baseUrl}
                                        </div>
                                        <div className="card-sub" style={{ wordBreak: "break-all" }}>
                                            {t("page.lan.pairing_scan.tls_fingerprint")}{" "}
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
                    {t("page.lan.pairing_scan.manual_title")}
                </h2>
                <p className="card-sub">
                    {t("page.lan.pairing_scan.manual_hint")}{" "}
                    <code>https://192.168.1.10:8787</code>.
                </p>
                <Input
                    id="manual-master-url"
                    label={t("page.lan.pairing_scan.label.master_url")}
                    hint={t("page.lan.pairing_scan.hint.master_url")}
                    placeholder="https://192.168.1.10:8787"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                />
                <Input
                    id="manual-master-cert"
                    label={t("page.lan.pairing_scan.label.tls_sha256")}
                    hint={t("page.lan.pairing_scan.hint.tls_sha256")}
                    value={manualCert}
                    onChange={(e) => setManualCert(e.target.value)}
                />
            </section>

            <section style={{ marginTop: 16 }}>
                <Input
                    id="slave-label"
                    label={t("page.lan.pairing_scan.label.device")}
                    placeholder={t("page.lan.pairing_scan.placeholder.device")}
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
                    {t("page.lan.pairing_scan.submit")}
                </Button>
            </section>
        </main>
    );
}
