import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { DATENSCHUTZ_UI_ENABLED } from "@/lib/datenschutz-config";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
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

/*
 * Deferred security/compliance items: docs/coordination/geplant.md (not shown in UI).
 * Legacy stub UI (Portal-Flags, Kartenleser-Pille, Konform-Badge) at file end.
 */

function totpStatusLine(status: TotpStatus | null, busy: boolean): { label: string; pill: string; pillClass: string } {
    if (busy) return { label: "Status wird geladen …", pill: "…", pillClass: "settings-pill-gray" };
    if (!status) return { label: "Authenticator — Status nicht verfügbar", pill: "—", pillClass: "settings-pill-gray" };
    if (status.enrolled) {
        return {
            label: status.required
                ? "Authenticator-App ist eingerichtet (Pflicht für Ihre Rolle)"
                : "Authenticator-App ist eingerichtet",
            pill: "Aktiv",
            pillClass: "settings-pill-green",
        };
    }
    if (status.pending) {
        return {
            label: "Einrichtung begonnen — beim nächsten Anmelden abschließen",
            pill: "Ausstehend",
            pillClass: "settings-pill-orange",
        };
    }
    if (status.required) {
        return {
            label: "Pflicht für Ihre Rolle — beim nächsten Anmelden einrichten",
            pill: "Erforderlich",
            pillClass: "settings-pill-orange",
        };
    }
    return {
        label: "Optional — Einrichtung erfolgt bei der Anmeldung",
        pill: "Aus",
        pillClass: "settings-pill-gray",
    };
}

export function EinstellungenSicherheitSection({
    security,
    onPersistClient,
}: EinstellungenSicherheitSectionProps) {
    const { canReadAudit, canRoute, canOpsSystem } = useRbac();
    const toast = useToastStore((s) => s.add);
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
        void refreshTotpStatus();
    }, [refreshTotpStatus]);

    const totp = totpStatusLine(totpStatus, totpBusy);
    const showDeactivate = totpStatus?.enrolled === true;
    const showCancelPending = totpStatus?.pending === true;

    async function confirmDeactivate() {
        setDeactivateBusy(true);
        try {
            await deactivateTotp(deactivateCode.trim());
            setDeactivateOpen(false);
            setDeactivateCode("");
            toast("Zwei-Faktor-Authentifizierung deaktiviert");
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
            toast("Zwei-Faktor-Einrichtung abgebrochen");
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

    return (
        <div className="settings-security-stack">
            <section className="settings-subcard settings-security-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">Sicherheit</div>
                        <div className="card-sub">
                            Sitzungsschutz, Zwei-Faktor-Status und Compliance-Verknüpfungen
                        </div>
                    </div>
                </div>

                <div className="settings-security-group">
                    <div className="settings-security-group__title">Sitzung &amp; Zugriff</div>

                    {canOpsSystem ? (
                        <div className="settings-row settings-security-row">
                            <div className="settings-security-row__body">
                                <b>Auto-Sperre nach Inaktivität</b>
                                <div className="card-sub">
                                    {idleOn
                                        ? `Nach ${idleMins} Minute${idleMins === 1 ? "" : "n"} ohne Aktivität wird abgemeldet`
                                        : "Aus — Arbeitsplatz bleibt nach Inaktivität angemeldet"}
                                </div>
                            </div>
                            <SettingsSwitch
                                ariaLabel="Auto-Sperre"
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

                    <div className="settings-row settings-security-row">
                        <div className="settings-security-row__body">
                            <b>Zwei-Faktor-Authentifizierung (2FA)</b>
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
                                    Deaktivieren
                                </button>
                            ) : null}
                            {showCancelPending ? (
                                <button
                                    type="button"
                                    className="btn btn-subtle settings-security-link-btn"
                                    onClick={() => void cancelPendingEnrollment()}
                                    disabled={totpBusy || cancelPendingBusy}
                                >
                                    {cancelPendingBusy ? "…" : "Abbrechen"}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {showComplianceLinks ? (
                    <div className="settings-security-group">
                        <div className="settings-security-group__title">Nachweis &amp; Compliance</div>

                        {canReadAudit ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>Audit-Protokoll</b>
                                    <div className="card-sub">Ereignisse der letzten 90 Tage einsehen</div>
                                </div>
                                <Link to="/audit" className="btn btn-subtle settings-security-link-btn">
                                    Anzeigen
                                </Link>
                            </div>
                        ) : null}

                        {showDatenschutzLink ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>Datenexport (DSGVO)</b>
                                    <div className="card-sub">Patientendaten auf Anfrage exportieren</div>
                                </div>
                                <Link to="/datenschutz" className="btn btn-subtle settings-security-link-btn">
                                    Anfordern
                                </Link>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <EinstellungenDeviceSessionsSection />

            <Dialog
                open={deactivateOpen}
                onClose={() => {
                    if (deactivateBusy) return;
                    setDeactivateOpen(false);
                    setDeactivateCode("");
                }}
                title="Zwei-Faktor deaktivieren"
                presentation="centered"
                footer={
                    <IosConfirmActions
                        cancelLabel="Abbrechen"
                        confirmLabel="Deaktivieren"
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
                    Geben Sie den aktuellen 6-stelligen Code aus Ihrer Authenticator-App ein.
                    {totpStatus?.required
                        ? " Bei Ihrer Rolle müssen Sie beim nächsten Anmelden erneut einen Authenticator einrichten."
                        : null}
                </p>
                <Input
                    id="settings-totp-deactivate-code"
                    label="Authenticator-Code"
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

/*
 * --- Deferred / non-functional UI (preserved for later wiring) ---
 *
 * import { companyPortalFetchFeatureFlags, companyPortalFetchIntegrations } from settings-page.controller;
 * import { portalIntegrationPill } from settings-format;
 *
 * // Org-wide 2FA toggle — only wrote client JSON, never enforced login:
 * <SettingsSwitch
 *   checked={security.twoFactorEnabled !== false}
 *   onChange={() => onPersistClient(... twoFactorEnabled ...)}
 * />
 *
 * // HBA card reader — portal stub with example terminal ID:
 * <div className="settings-row">
 *   <b>HBA / eGK Kartenleser</b>
 *   <span className={cardReaderPill.className}>{cardReaderPill.label}</span>
 * </div>
 *
 * // Misleading compliance badge:
 * <span className="settings-pill-green">Konform</span>
 *
 * // Audit subtitle with healthLast.audit_chain_ok — parent never loaded health:
 * healthLast ? `... ${healthLast.audit_chain_ok ? "Kette intakt" : "..."}` : "..."
 */
