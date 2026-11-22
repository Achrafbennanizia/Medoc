import { isCompletePairingCode, normalizePairingCodeInput, PAIRING_CODE_LENGTH } from "@/lib/pairing-code";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    clusterDiscoverAdmins,
    clusterGetStatus,
    clusterSendJoinRequest,
    clusterSubmitSas,
    type AdminEndpoint,
    type JoinAdminTarget,
    type PairingHandle,
} from "@/systems/practice-host/controllers/cluster.controller";
import { useClusterStore } from "@/models/store/cluster-store";
import { Button } from "@/views/components/ui/button";
import { errorMessage, masterDeviceUnreachable } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";
import { rewriteDigitsForMode } from "@/lib/arabic-numerals";
import { useT } from "@/lib/i18n";
import { PAGE_REFRESH_EVENT } from "@/views/layouts/page-refresh";

const DEFAULT_PORT = 49300;

type Phase = "scan" | "manual" | "sas" | "wait";

export type ClusterJoinFlowProps = {
    onComplete?: () => void;
    onBack?: () => void;
    /** After join: account choice (create or sign in). */
    completeWithAccountSetup?: boolean;
    /** Onboarding legacy: redirect to login after successful join. */
    completeWithLogin?: boolean;
};

export function ClusterJoinFlow({ onComplete, onBack, completeWithAccountSetup = false, completeWithLogin = false }: ClusterJoinFlowProps) {
    const navigate = useNavigate();
    const setStatus = useClusterStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const [admins, setAdmins] = useState<AdminEndpoint[]>([]);
    const [handle, setHandle] = useState<PairingHandle | null>(null);
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
            const found = await clusterDiscoverAdmins();
            setAdmins(found);
            setScannedOnce(true);
            if (found.length === 0) {
                toast(t("page.lan.cluster_join.no_admins"), "warning");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setScanBusy(false);
        }
    }, [toast, t]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void scan();
        }, 1800);
        return () => window.clearTimeout(timer);
    }, [scan]);

    const finishSuccess = useCallback(async () => {
        setStatus(await clusterGetStatus().catch(() => null));
        if (completeWithAccountSetup || completeWithLogin) {
            navigate("/login", { replace: true });
            return;
        }
        onComplete?.();
        window.dispatchEvent(new Event(PAGE_REFRESH_EVENT));
        window.setTimeout(() => window.dispatchEvent(new Event(PAGE_REFRESH_EVENT)), 600);
    }, [completeWithAccountSetup, completeWithLogin, navigate, onComplete, setStatus]);

    const join = async (admin: JoinAdminTarget) => {
        setJoinBusy(true);
        try {
            const result = await clusterSendJoinRequest("MEMBER", admin);
            setHandle(result);
            setHandshakeTranscriptB64(result.handshakeTranscriptB64);
            setPhase("sas");
            toast(t("page.lan.cluster_join.toast.request_sent"), "info");
        } catch (e) {
            const raw = errorMessage(e);
            toast(
                masterDeviceUnreachable(raw)
                    ? t("page.lan.cluster_join.toast.connect_failed")
                    : `${t("page.lan.cluster_join.toast.connect_failed")} ${raw}`,
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
            toast(t("page.lan.cluster_join.toast.connect_failed"), "error");
            return;
        }
        void join({ host, port });
    };

    const confirmSas = async () => {
        if (!handle || !isCompletePairingCode(digits)) return;
        setJoinBusy(true);
        setPhase("wait");
        try {
            const result = await clusterSubmitSas(handle, digits, handshakeTranscriptB64);
            if (result.success) {
                toast(t("page.lan.cluster_join.toast.provisioning_done"), "success");
                await finishSuccess();
            } else if (result.alreadyProvisioned) {
                setPhase("sas");
                toast(t("page.lan.cluster_join.toast.already_provisioned"), "error");
            } else {
                setPhase("sas");
                toast(t("page.lan.cluster_join.toast.sas_invalid"), "error");
            }
        } catch (e) {
            setPhase("sas");
            const raw = errorMessage(e);
            toast(
                masterDeviceUnreachable(raw) ? t("page.lan.cluster_join.toast.connect_failed") : raw,
                "error",
            );
        } finally {
            setJoinBusy(false);
        }
    };

    const busy = scanBusy || joinBusy;

    return (
        <div className="cluster-join-flow">
            {phase === "scan" && (
                <>
                    {scanBusy ? (
                        <p className="card-sub" role="status">
                            {t("page.lan.cluster_join.scanning")}
                        </p>
                    ) : null}
                    {scannedOnce && !scanBusy && admins.length === 0 ? (
                        <p className="card-sub" role="status">
                            {t("page.lan.cluster_join.no_admins")}
                        </p>
                    ) : null}
                    {admins.length > 0 ? (
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
                                            ? t("page.lan.cluster_join.connecting")
                                            : t("page.lan.cluster_join.connect")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <div className="onboarding-actions onboarding-actions--row">
                        <Button type="button" disabled={busy} onClick={() => void scan()}>
                            {scanBusy ? t("page.lan.cluster_join.scanning") : t("page.lan.cluster_join.scan_network")}
                        </Button>
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => setPhase("manual")}>
                            {t("page.lan.cluster_join.connect_manual")}
                        </Button>
                        {onBack ? (
                            <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
                                {t("license.activate.device_role.back")}
                            </Button>
                        ) : null}
                    </div>
                </>
            )}

            {phase === "manual" && (
                <>
                    <label className="onboarding-field">
                        {t("page.lan.cluster_join.manual_host")}
                        <input
                            type="text"
                            value={manualHost}
                            onChange={(e) => setManualHost(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("page.lan.cluster_join.manual_port")}
                        <input
                            type="number"
                            min={1}
                            max={65535}
                            value={manualPort}
                            onChange={(e) => setManualPort(e.target.value)}
                        />
                    </label>
                    <div className="onboarding-actions onboarding-actions--row">
                        <Button type="button" disabled={busy || !manualHost.trim()} onClick={connectManual}>
                            {joinBusy ? t("page.lan.cluster_join.connecting") : t("page.lan.cluster_join.manual_connect")}
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
                            {t("page.lan.cluster_join.back")}
                        </Button>
                    </div>
                </>
            )}

            {phase === "sas" && (
                <>
                    <p className="card-sub">{t("page.lan.cluster_join.sas_hint")}</p>
                    <label className="onboarding-field">
                        {t("page.lan.cluster_join.sas_label")}
                        <input
                            inputMode="numeric"
                            maxLength={PAIRING_CODE_LENGTH}
                            value={digits}
                            onChange={(e) =>
                                setDigits(normalizePairingCodeInput(rewriteDigitsForMode(e.target.value, "western")))
                            }
                        />
                    </label>
                    <div className="onboarding-actions onboarding-actions--row">
                        <Button
                            type="button"
                            loading={joinBusy}
                            disabled={joinBusy || !isCompletePairingCode(digits)}
                            onClick={() => void confirmSas()}
                        >
                            {joinBusy ? t("page.lan.cluster_join.provisioning_wait") : t("common.confirm")}
                        </Button>
                        <Button type="button" variant="secondary" disabled={joinBusy} onClick={resetJoin}>
                            {t("page.lan.cluster_join.cancel")}
                        </Button>
                    </div>
                </>
            )}

            {phase === "wait" ? <p role="status">{t("page.lan.cluster_join.provisioning_wait")}</p> : null}
        </div>
    );
}
