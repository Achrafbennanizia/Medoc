import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";

import {
    clusterClusterResetExecute,
    clusterClusterResetPreview,
    type ClusterResetMode,
    type ClusterResetPreview,
} from "@/systems/practice-host/controllers/cluster.controller";
import { clearDesktopLicenseClientState } from "@/systems/practice-host/lib/clear-desktop-license-client-state";
import { useAuthStore } from "@/models/store/auth-store";
import { useClusterStore } from "@/models/store/cluster-store";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/views/components/ui/button";
import { Dialog, IosConfirmActions } from "@/views/components/ui/dialog";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

type Props = {
    canOpsSystem: boolean;
};

export function SettingsNetworkResetSection({ canOpsSystem }: Props) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const clearAuth = useAuthStore((s) => s.clear);
    const setStatus = useClusterStore((s) => s.setStatus);
    const status = useClusterStore((s) => s.status);

    const [preview, setPreview] = useState<ClusterResetPreview | null>(null);
    const [mode, setMode] = useState<ClusterResetMode>("network_only");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPhrase, setConfirmPhrase] = useState("");
    const [ackBackup, setAckBackup] = useState(false);
    const [busy, setBusy] = useState(false);
    const confirmTitleId = useId();

    const visible = canOpsSystem && status?.isOwner && status?.licensed;

    const resetConfirmForm = useCallback(() => {
        setPassword("");
        setConfirmPhrase("");
        setAckBackup(false);
    }, []);

    const openConfirm = () => {
        resetConfirmForm();
        setConfirmOpen(true);
    };

    const closeConfirm = () => {
        if (busy) return;
        setConfirmOpen(false);
        resetConfirmForm();
    };

    const phraseMatches = preview
        ? confirmPhrase.trim().length > 0 &&
          (confirmPhrase.trim().toLowerCase() === preview.confirmPhraseHint.toLowerCase() ||
              (preview.practiceSlug != null &&
                  preview.practiceSlug.length > 0 &&
                  confirmPhrase.trim().toLowerCase() === preview.practiceSlug.toLowerCase()))
        : false;

    const canSubmit =
        phraseMatches &&
        password.trim().length > 0 &&
        (mode !== "full_wipe" || ackBackup);

    const loadPreview = useCallback(() => {
        if (!visible) return;
        void clusterClusterResetPreview()
            .then(setPreview)
            .catch((e: unknown) => toast(errorMessage(e), "error"));
    }, [visible, toast]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    if (!visible) {
        return null;
    }

    const execute = async () => {
        if (mode === "full_wipe" && !ackBackup) {
            toast(t("settings.network_reset.backup_required"), "error");
            return;
        }
        setBusy(true);
        try {
            clearDesktopLicenseClientState();
            await clusterClusterResetExecute({
                mode,
                password,
                confirmPhrase: confirmPhrase.trim(),
            });
            clearAuth();
            setStatus(null);
            toast(t("settings.network_reset.restarting"), "info");
            // Rust schedules a full app restart — do not reload the webview only.
        } catch (e) {
            toast(tp("settings.network_reset.error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="settings-subcard settings-subcard--danger">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.network_reset.title")}</div>
                    <div className="card-sub">{t("settings.network_reset.subtitle")}</div>
                </div>
            </div>

            <p className="card-sub network-reset-section__intro">
                {t("settings.network_reset.intro")}
            </p>

            {preview ? (
                <p className="card-sub network-reset-section__meta">
                    {tp("settings.network_reset.devices_count", {
                        count: String(preview.memberDeviceCount),
                    })}
                    {preview.clusterId ? (
                        <>
                            {" "}
                            · {t("settings.network_reset.cluster_id")}:{" "}
                            <code>{preview.clusterId.slice(0, 8)}…</code>
                        </>
                    ) : null}
                </p>
            ) : null}

            <div className="network-reset-mode-grid" role="radiogroup" aria-label={t("settings.network_reset.mode_group")}>
                <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "network_only"}
                    className={`license-device-role-card network-reset-mode-card${mode === "network_only" ? " license-device-role-card--selected" : ""}`}
                    onClick={() => setMode("network_only")}
                >
                    <strong>{t("settings.network_reset.mode_network_title")}</strong>
                    <span className="card-sub">{t("settings.network_reset.mode_network_hint")}</span>
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "full_wipe"}
                    className={`license-device-role-card network-reset-mode-card${mode === "full_wipe" ? " license-device-role-card--selected" : ""}`}
                    onClick={() => setMode("full_wipe")}
                >
                    <strong>{t("settings.network_reset.mode_full_title")}</strong>
                    <span className="card-sub">{t("settings.network_reset.mode_full_hint")}</span>
                    <span className="license-device-role-card__badge license-device-role-card__badge--muted">
                        {t("settings.network_reset.mode_full_badge")}
                    </span>
                </button>
            </div>

            <p className="card-sub network-reset-section__backup-link">
                <Link to="/ops">{t("settings.network_reset.backup_link")}</Link>
            </p>

            <div className="settings-row network-reset-section__actions">
                <Button type="button" variant="danger" onClick={openConfirm}>
                    {t("settings.network_reset.open_confirm")}
                </Button>
            </div>

            <Dialog
                open={confirmOpen}
                onClose={closeConfirm}
                title=""
                labelledBy={confirmTitleId}
                presentation="centered"
                className="modal--network-reset-confirm"
            >
                <div className="network-reset-confirm">
                    <div className="network-reset-confirm__banner" role="alert">
                        <span className="network-reset-confirm__icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </span>
                        <p className="network-reset-confirm__banner-text">
                            {t("settings.network_reset.confirm_intro")}
                        </p>
                    </div>

                    <div className="network-reset-confirm__body">
                        <h2 id={confirmTitleId} className="network-reset-confirm__title">
                            {t("settings.network_reset.confirm_title")}
                        </h2>

                        <p className="network-reset-confirm__mode">
                            {mode === "full_wipe"
                                ? t("settings.network_reset.mode_full_title")
                                : t("settings.network_reset.mode_network_title")}
                        </p>

                        {preview ? (
                            <div className="network-reset-confirm__phrase-block">
                                <span className="network-reset-confirm__phrase-label">
                                    {t("settings.network_reset.confirm_phrase_type")}
                                </span>
                                <code className="network-reset-confirm__phrase">{preview.confirmPhraseHint}</code>
                            </div>
                        ) : null}

                        <div className="network-reset-confirm__fields">
                            <Input
                                label={t("settings.network_reset.confirm_phrase_label")}
                                value={confirmPhrase}
                                onChange={(e) => setConfirmPhrase(e.target.value)}
                                autoComplete="off"
                                disabled={busy}
                                autoFocus
                            />
                            <Input
                                label={t("settings.network_reset.password_label")}
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                disabled={busy}
                            />
                        </div>

                        {mode === "full_wipe" ? (
                            <label className="network-reset-confirm__ack">
                                <input
                                    type="checkbox"
                                    checked={ackBackup}
                                    onChange={(e) => setAckBackup(e.target.checked)}
                                    disabled={busy}
                                />
                                <span>{t("settings.network_reset.backup_ack")}</span>
                            </label>
                        ) : null}
                    </div>

                    <IosConfirmActions
                        cancelLabel={t("common.cancel")}
                        confirmLabel={t("settings.network_reset.confirm_btn")}
                        destructive
                        loading={busy}
                        disabled={!canSubmit}
                        onCancel={closeConfirm}
                        onConfirm={() => void execute()}
                    />
                </div>
            </Dialog>
        </section>
    );
}
