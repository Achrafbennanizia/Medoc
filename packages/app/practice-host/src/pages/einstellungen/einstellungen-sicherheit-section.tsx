import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { DATENSCHUTZ_UI_ENABLED } from "@/lib/datenschutz-config";
import { TOTP_2FA_ENABLED } from "@/lib/mvp-security-config";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { useT, useTParams } from "@/lib/i18n";
import {
    deactivateTotp,
    getTotpStatus,
    type TotpStatus,
} from "@/systems/practice-host/controllers/totp.controller";
import { Dialog, IosConfirmActions } from "@/views/components/ui/dialog";
import { Input } from "@/views/components/ui/input";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { useToastStore } from "@/views/components/ui/toast-store";
import { EinstellungenDeviceSessionsSection } from "./einstellungen-device-sessions-section";

type SecurityPrefs = NonNullable<ClientSettingsV1["security"]>;

export type EinstellungenSicherheitSectionProps = {
    security: SecurityPrefs;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

function totpStatusLine(
    status: TotpStatus | null,
    busy: boolean,
    t: (key: string) => string,
): { label: string; pill: string; pillClass: string } {
    if (busy) return { label: t("settings.security.totp.loading"), pill: "…", pillClass: "settings-pill-gray" };
    if (!status) return { label: t("settings.security.totp.unavailable"), pill: "—", pillClass: "settings-pill-gray" };
    if (status.enrolled) {
        return {
            label: status.required ? t("settings.security.totp.enrolled_required") : t("settings.security.totp.enrolled"),
            pill: t("settings.security.pill_active"),
            pillClass: "settings-pill-green",
        };
    }
    if (status.pending) {
        return {
            label: t("settings.security.totp.pending"),
            pill: t("settings.security.pill_pending"),
            pillClass: "settings-pill-orange",
        };
    }
    if (status.required) {
        return {
            label: t("settings.security.totp.required"),
            pill: t("settings.security.pill_required"),
            pillClass: "settings-pill-orange",
        };
    }
    return {
        label: t("settings.security.totp.optional"),
        pill: t("settings.security.pill_off"),
        pillClass: "settings-pill-gray",
    };
}

export function EinstellungenSicherheitSection({
    security,
    onPersistClient,
}: EinstellungenSicherheitSectionProps) {
    const { canReadAudit, canRoute, canOpsSystem } = useRbac();
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [totpStatus, setTotpStatus] = useState<TotpStatus | null>(null);
    const [totpBusy, setTotpBusy] = useState(true);
    const [deactivateOpen, setDeactivateOpen] = useState(false);
    const [deactivateCode, setDeactivateCode] = useState("");
    const [deactivateBusy, setDeactivateBusy] = useState(false);
    const [cancelPendingBusy, setCancelPendingBusy] = useState(false);

    const refreshTotpStatus = useCallback(async () => {
        setTotpBusy(true);
        try {
            setTotpStatus(await getTotpStatus());
        } catch {
            setTotpStatus(null);
        } finally {
            setTotpBusy(false);
        }
    }, []);

    useEffect(() => {
        if (TOTP_2FA_ENABLED) void refreshTotpStatus();
        else setTotpBusy(false);
    }, [refreshTotpStatus]);

    const totp = totpStatusLine(totpStatus, totpBusy, t);
    const showDeactivate = totpStatus?.enrolled === true;
    const showCancelPending = totpStatus?.pending === true;

    async function confirmDeactivate() {
        setDeactivateBusy(true);
        try {
            await deactivateTotp(deactivateCode.trim());
            setDeactivateOpen(false);
            setDeactivateCode("");
            toast(t("settings.security.totp.deactivated"));
            await refreshTotpStatus();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setDeactivateBusy(false);
        }
    }

    async function cancelPendingEnrollment() {
        setCancelPendingBusy(true);
        try {
            await deactivateTotp();
            toast(t("settings.security.totp.cancelled"));
            await refreshTotpStatus();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setCancelPendingBusy(false);
        }
    }
    const idleOn = (security.idleLogoutMinutes ?? 0) > 0;
    const idleMins = security.idleLogoutMinutes ?? 0;

    const showDatenschutzLink = DATENSCHUTZ_UI_ENABLED && canRoute("datenschutz");
    const showComplianceLinks = canReadAudit || showDatenschutzLink;

    const idleHint = idleOn
        ? idleMins === 1
            ? tp("settings.security.idle_on_one", { minutes: idleMins })
            : tp("settings.security.idle_on_many", { minutes: idleMins })
        : t("settings.security.idle_off");

    return (
        <div className="settings-security-stack">
            <section className="settings-subcard settings-security-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("settings.security.title")}</div>
                        <div className="card-sub">
                            {TOTP_2FA_ENABLED ? t("settings.security.subtitle") : t("settings.security.subtitle_no_totp")}
                        </div>
                    </div>
                </div>

                <div className="settings-security-group">
                    <div className="settings-security-group__title">{t("settings.security.session_group")}</div>

                    {canOpsSystem ? (
                        <div className="settings-row settings-security-row">
                            <div className="settings-security-row__body">
                                <b>{t("settings.security.idle_lock")}</b>
                                <div className="card-sub">{idleHint}</div>
                            </div>
                            <SettingsSwitch
                                ariaLabel={t("settings.security.idle_lock.aria")}
                                checked={idleOn}
                                onChange={() =>
                                    onPersistClient((c) => {
                                        const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                        const on = (s.idleLogoutMinutes ?? 0) > 0;
                                        return mergeClientSettingsPatch(c, {
                                            security: { ...s, idleLogoutMinutes: on ? 0 : 5 },
                                        });
                                    })
                                }
                            />
                        </div>
                    ) : null}

                    {TOTP_2FA_ENABLED ? (
                    <div className="settings-row settings-security-row">
                        <div className="settings-security-row__body">
                            <b>{t("settings.security.totp_title")}</b>
                            <div className="card-sub">{totp.label}</div>
                        </div>
                        <div className="row" style={{ gap: 8, alignItems: "center", flexShrink: 0 }}>
                            <span className={totp.pillClass}>{totp.pill}</span>
                            {showDeactivate ? (
                                <button
                                    type="button"
                                    className="btn btn-subtle settings-security-link-btn"
                                    onClick={() => setDeactivateOpen(true)}
                                    disabled={totpBusy}
                                >
                                    {t("common.deactivate")}
                                </button>
                            ) : null}
                            {showCancelPending ? (
                                <button
                                    type="button"
                                    className="btn btn-subtle settings-security-link-btn"
                                    onClick={() => void cancelPendingEnrollment()}
                                    disabled={totpBusy || cancelPendingBusy}
                                >
                                    {cancelPendingBusy ? "…" : t("common.cancel")}
                                </button>
                            ) : null}
                        </div>
                    </div>
                    ) : null}
                </div>

                {showComplianceLinks ? (
                    <div className="settings-security-group">
                        <div className="settings-security-group__title">{t("settings.security.compliance_group")}</div>

                        {canReadAudit ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>{t("settings.security.audit_title")}</b>
                                    <div className="card-sub">{t("settings.security.audit.hint")}</div>
                                </div>
                                <Link to="/audit" className="btn btn-subtle settings-security-link-btn">
                                    {t("common.show")}
                                </Link>
                            </div>
                        ) : null}

                        {showDatenschutzLink ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>{t("settings.security.dsgvo_title")}</b>
                                    <div className="card-sub">{t("settings.security.gdpr.hint")}</div>
                                </div>
                                <Link to="/datenschutz" className="btn btn-subtle settings-security-link-btn">
                                    {t("common.request")}
                                </Link>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <EinstellungenDeviceSessionsSection />

            <Dialog
                open={TOTP_2FA_ENABLED && deactivateOpen}
                onClose={() => {
                    if (deactivateBusy) return;
                    setDeactivateOpen(false);
                    setDeactivateCode("");
                }}
                title={t("settings.security.totp.deactivate_title")}
                presentation="centered"
                footer={
                    <IosConfirmActions
                        cancelLabel={t("common.cancel")}
                        confirmLabel={t("common.deactivate")}
                        destructive
                        loading={deactivateBusy}
                        disabled={deactivateCode.trim().length !== 6}
                        onCancel={() => {
                            setDeactivateOpen(false);
                            setDeactivateCode("");
                        }}
                        onConfirm={() => void confirmDeactivate()}
                    />
                }
            >
                <p className="text-body text-on-surface-variant" style={{ margin: "0 0 12px" }}>
                    {t("settings.security.totp.deactivate_body")}
                    {totpStatus?.required ? t("settings.security.totp.deactivate_required_hint") : null}
                </p>
                <Input
                    id="settings-totp-deactivate-code"
                    label={t("settings.security.totp.code_label")}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={deactivateCode}
                    onChange={(e) =>
                        setDeactivateCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                />
            </Dialog>
        </div>
    );
}
