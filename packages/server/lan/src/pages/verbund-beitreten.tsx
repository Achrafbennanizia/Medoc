/**
 * Join practice federation — pairing only (no practice data visible).
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    verbundDiscoverAdmins,
    verbundGetStatus,
    verbundSendJoinRequest,
    verbundSubmitSas,
    type AdminEndpoint,
    type JoinAdminTarget,
    type KopplungHandle,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT } from "@/lib/i18n";
import { OnboardingShell } from "@/views/components/onboarding-shell";

const DEFAULT_PORT = 49300;

type Phase = "scan" | "manual" | "sas" | "wait";

export function VerbundBeitretenPage() {
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const [admins, setAdmins] = useState<AdminEndpoint[]>([]);
    const [handle, setHandle] = useState<KopplungHandle | null>(null);
    const [handshakeTranscriptB64, setHandshakeTranscriptB64] = useState("");
    const [digits, setDigits] = useState("");
    const [scanBusy, setScanBusy] = useState(false);
    const [joinBusy, setJoinBusy] = useState(false);
    const [phase, setPhase] = useState<Phase>("scan");
    const [scannedOnce, setScannedOnce] = useState(false);
    const [manualHost, setManualHost] = useState("");
    const [manualPort, setManualPort] = useState(String(DEFAULT_PORT));

    const resetJoin = useCallback(() => {
        setHandle(null);
        setHandshakeTranscriptB64("");
        setDigits("");
        setJoinBusy(false);
        setPhase("scan");
    }, []);

    const scan = useCallback(async () => {
        setScanBusy(true);
        try {
            const found = await verbundDiscoverAdmins();
            setAdmins(found);
            setScannedOnce(true);
            if (found.length === 0) {
                toast(t("page.lan.verbund_join.no_admins"), "warning");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setScanBusy(false);
        }
    }, [toast, t]);

    useEffect(() => {
        void scan();
    }, [scan]);

    const join = async (admin: JoinAdminTarget) => {
        setJoinBusy(true);
        try {
            const result = await verbundSendJoinRequest("MEMBER", admin);
            setHandle(result);
            setHandshakeTranscriptB64(result.handshakeTranscriptB64);
            setPhase("sas");
            toast(t("page.lan.verbund_join.toast.request_sent"), "info");
        } catch (e) {
            toast(
                `${t("page.lan.verbund_join.toast.connect_failed")} ${errorMessage(e)}`,
                "error",
            );
        } finally {
            setJoinBusy(false);
        }
    };

    const connectManual = () => {
        const host = manualHost.trim();
        const port = Number.parseInt(manualPort, 10);
        if (!host || Number.isNaN(port) || port < 1 || port > 65535) {
            toast(t("page.lan.verbund_join.toast.connect_failed"), "error");
            return;
        }
        void join({ host, port });
    };

    const confirmSas = async () => {
        if (!handle) return;
        setJoinBusy(true);
        try {
            const result = await verbundSubmitSas(handle, digits, handshakeTranscriptB64);
            if (result.success) {
                setPhase("wait");
                toast(t("page.lan.verbund_join.toast.provisioning_done"), "success");
                setStatus(await verbundGetStatus());
                navigate("/login", { replace: true });
            } else if (result.alreadyProvisioned) {
                toast(t("page.lan.verbund_join.toast.already_provisioned"), "error");
            } else {
                toast(t("page.lan.verbund_join.toast.sas_invalid"), "error");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setJoinBusy(false);
        }
    };

    const busy = scanBusy || joinBusy;

    return (
        <OnboardingShell>
            <h1>{t("page.lan.verbund_join.title")}</h1>
            <p className="card-sub">{t("page.lan.verbund_join.subtitle")}</p>

            {phase === "scan" && (
                <>
                    {scanBusy && (
                        <p className="card-sub" role="status">
                            {t("page.lan.verbund_join.scanning")}
                        </p>
                    )}
                    {scannedOnce && !scanBusy && admins.length === 0 && (
                        <p className="card-sub" role="status">
                            {t("page.lan.verbund_join.no_admins")}
                        </p>
                    )}
                    {admins.length > 0 && (
                        <ul className="onboarding-admin-list">
                            {admins.map((a) => (
                                <li key={`${a.host}:${a.port}`} className="onboarding-admin-card">
                                    <div>
                                        <strong>{a.instanceName}</strong>
                                        <div className="card-sub">
                                            {a.host}:{a.port}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => void join({ host: a.host, port: a.port })}
                                    >
                                        {joinBusy
                                            ? t("page.lan.verbund_join.connecting")
                                            : t("page.lan.verbund_join.connect")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="onboarding-actions">
                        <Button type="button" disabled={busy} onClick={() => void scan()}>
                            {scanBusy
                                ? t("page.lan.verbund_join.scanning")
                                : t("page.lan.verbund_join.scan_network")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setPhase("manual")}
                        >
                            {t("page.lan.verbund_join.connect_manual")}
                        </Button>
                        <Link to="/onboarding" className="btn btn-subtle">
                            {t("page.lan.verbund_join.back")}
                        </Link>
                    </div>
                </>
            )}

            {phase === "manual" && (
                <>
                    <label className="onboarding-field">
                        {t("page.lan.verbund_join.manual_host")}
                        <input
                            type="text"
                            value={manualHost}
                            onChange={(e) => setManualHost(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("page.lan.verbund_join.manual_port")}
                        <input
                            type="number"
                            min={1}
                            max={65535}
                            value={manualPort}
                            onChange={(e) => setManualPort(e.target.value)}
                        />
                    </label>
                    <div className="onboarding-actions">
                        <Button
                            type="button"
                            disabled={busy || !manualHost.trim()}
                            onClick={connectManual}
                        >
                            {joinBusy
                                ? t("page.lan.verbund_join.connecting")
                                : t("page.lan.verbund_join.manual_connect")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                                setManualHost("");
                                setManualPort(String(DEFAULT_PORT));
                                setPhase("scan");
                            }}
                        >
                            {t("page.lan.verbund_join.back")}
                        </Button>
                    </div>
                </>
            )}

            {phase === "sas" && (
                <>
                    <p className="card-sub">{t("page.lan.verbund_join.sas_hint")}</p>
                    <label className="onboarding-field">
                        {t("page.lan.verbund_join.sas_label")}
                        <input
                            inputMode="numeric"
                            maxLength={4}
                            value={digits}
                            onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                    </label>
                    <div className="onboarding-actions">
                        <Button
                            type="button"
                            disabled={joinBusy || digits.length !== 4}
                            onClick={() => void confirmSas()}
                        >
                            {t("common.confirm")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={joinBusy}
                            onClick={resetJoin}
                        >
                            {t("page.lan.verbund_join.cancel")}
                        </Button>
                    </div>
                </>
            )}

            {phase === "wait" && (
                <p role="status">{t("page.lan.verbund_join.provisioning_wait")}</p>
            )}
        </OnboardingShell>
    );
}
