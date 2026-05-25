import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { LOCAL_INTEGRATION_CAPABILITIES } from "@/lib/integration-capabilities";
import { portalIntegrationPill } from "@/lib/settings-format";
import { SettingsSwitch } from "@/views/components/settings-switch";

type IntegrationsPrefs = NonNullable<ClientSettingsV1["integrations"]>;

export type EinstellungenIntegrationenSectionProps = {
    portalIntegrations: Record<string, unknown> | null;
    integrations: IntegrationsPrefs;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function EinstellungenIntegrationenSection({
    portalIntegrations,
    integrations,
    onPersistClient,
}: EinstellungenIntegrationenSectionProps) {
    const ep = portalIntegrations?.eprescription as { status?: string; detail?: string } | undefined;
    const epP = portalIntegrationPill(ep?.status);
    const datev = portalIntegrations?.datev as { status?: string; detail?: string } | undefined;
    const dc = portalIntegrations?.doccheck_sso as { status?: string; detail?: string } | undefined;
    const dcP = portalIntegrationPill(dc?.status);
    const tk = portalIntegrations?.kim_tk as { status?: string; detail?: string } | undefined;
    const tkP = portalIntegrationPill(tk?.status);
    const lab = portalIntegrations?.labor_dental_union as { status?: string; detail?: string } | undefined;
    const labP = portalIntegrationPill(lab?.status);

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Integrationen</div>
                    <div className="card-sub">
                        Anbindungen und Schnittstellen — Statuszeilen vom Hersteller-Portal, wenn unter System
                        konfiguriert.
                    </div>
                </div>
            </div>
            <p className="text-body text-on-surface-variant" style={{ margin: "0 0 8px", fontSize: 13 }}>
                Lokale Produktiv-Version: folgende Schnittstellen sind{" "}
                <strong>nicht live</strong> — Schalter und Aktionen dienen nur der Vorbereitung oder Demo.
            </p>
            <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 12.5, color: "var(--fg-3)" }}>
                {LOCAL_INTEGRATION_CAPABILITIES.map((c) => (
                    <li key={c.id}>
                        <b>{c.label}</b> — {c.reasonDe}
                    </li>
                ))}
            </ul>
            <div className="settings-row">
                <div>
                    <b>eRezept (Gematik)</b>
                    <div className="card-sub">
                        {ep?.detail ?? LOCAL_INTEGRATION_CAPABILITIES.find((x) => x.id === "eprescription")?.reasonDe}
                    </div>
                </div>
                <span className={epP.className}>{epP.label}</span>
            </div>
            <div className="settings-row">
                <div>
                    <b>DATEV</b>
                    <div className="card-sub">
                        Monatlicher Buchhaltungsexport
                        {datev?.detail ? (
                            <>
                                <br />
                                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Hersteller: {datev.detail}</span>
                            </>
                        ) : null}
                    </div>
                </div>
                <SettingsSwitch
                    ariaLabel="DATEV"
                    checked={integrations.datev !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const i = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                            const cur = i.datev !== false;
                            return mergeClientSettingsPatch(c, { integrations: { ...i, datev: !cur } });
                        })
                    }
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>DocCheck SSO</b>
                    <div className="card-sub">{dc?.detail ?? "Single Sign-On für Team"}</div>
                </div>
                <span className={dcP.className}>{dcP.label}</span>
            </div>
            <div className="settings-row">
                <div>
                    <b>TK-Direktabrechnung</b>
                    <div className="card-sub">{tk?.detail ?? "Kassenärztliche Abrechnung via KIM"}</div>
                </div>
                <span className={tkP.className}>{tkP.label}</span>
            </div>
            <div className="settings-row">
                <div>
                    <b>Labor (Dental Union)</b>
                    <div className="card-sub">{lab?.detail ?? "Auftragsweiterleitung"}</div>
                </div>
                <span className={labP.className}>{labP.label}</span>
            </div>
        </section>
    );
}
