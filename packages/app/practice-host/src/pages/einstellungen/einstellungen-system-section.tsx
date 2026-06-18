import {
    SYSTEM_AKTE_PHOTO_VIEWER_ENABLED,
    SYSTEM_APPEARANCE_TOGGLES_ENABLED,
    SYSTEM_COMPANY_PORTAL_ENABLED,
    SYSTEM_DIAGNOSTICS_ENABLED,
    SYSTEM_LAN_HOST_PANEL_ENABLED,
    SYSTEM_OPS_EXTRAS_ENABLED,
    SYSTEM_SERVERLESS_FOCUS_ENABLED,
} from "@/lib/settings-ui-flags";
import { EinstellungenCompanyPortalSection } from "@/systems/company-portal/pages/einstellungen-company-portal-section";
import { EinstellungenLanHostSection } from "@/systems/lan/pages/einstellungen-lan-host";
import { EinstellungenDeploymentSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-deployment-section";
import { EinstellungenPairingInbox } from "@/systems/practice-host/pages/einstellungen/einstellungen-pairing-inbox";
import { GeraeteverbundPanel } from "@/systems/practice-host/pages/einstellungen/geraeteverbund-panel";
import { VERBUND_ADMIN_PANEL_V1_ENABLED } from "@/lib/v1-ui-flags";

export type EinstellungenSystemSectionProps = {
    canOpsSystem: boolean;
};

export function EinstellungenSystemSection({ canOpsSystem }: EinstellungenSystemSectionProps) {
    if (SYSTEM_SERVERLESS_FOCUS_ENABLED) {
        return (
            <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
                <div className="card-head">
                    <div>
                        <div className="card-title">System</div>
                        <div className="card-sub">
                            Serverless-Verbindung: Master-Gerät und Replicas synchronisieren klinische Daten im LAN —
                            ohne dedizierten Server auf jedem Zweitgerät.
                        </div>
                    </div>
                </div>
                <div className="settings-system-stack settings-system-stack--flush">
                    {VERBUND_ADMIN_PANEL_V1_ENABLED ? <GeraeteverbundPanel embedded /> : null}
                    <EinstellungenDeploymentSection embedded showPairingInbox={canOpsSystem} />
                </div>
            </section>
        );
    }

    return (
        <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
            <div className="card-head">
                <div>
                    <div className="card-title">System</div>
                    <div className="card-sub">Diagnose, Performance, Daten und Betrieb</div>
                </div>
            </div>
            <div className="settings-system-stack">
                <EinstellungenDeploymentSection embedded />
                {canOpsSystem && SYSTEM_LAN_HOST_PANEL_ENABLED ? (
                    <>
                        <EinstellungenPairingInbox embedded />
                        <EinstellungenLanHostSection embedded />
                    </>
                ) : null}
                {canOpsSystem && SYSTEM_COMPANY_PORTAL_ENABLED ? (
                    <EinstellungenCompanyPortalSection embedded />
                ) : null}
            </div>
            {!SYSTEM_APPEARANCE_TOGGLES_ENABLED && !SYSTEM_AKTE_PHOTO_VIEWER_ENABLED && !SYSTEM_DIAGNOSTICS_ENABLED && !SYSTEM_OPS_EXTRAS_ENABLED ? (
                <p className="card-sub" style={{ padding: "12px var(--card-pad-x)" }}>
                    Weitere Systemoptionen sind vorübergehend ausgeblendet.
                </p>
            ) : null}
        </section>
    );
}
