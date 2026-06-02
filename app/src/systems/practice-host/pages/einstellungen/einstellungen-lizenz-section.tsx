import {
    companyPortalBillingPortalUrl,
    openSubscriptionPortal,
    type LicenseStatus,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { formatDeDateShort, formatEurFromCents } from "@/lib/settings-format";
import { ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

export type EinstellungenLizenzSectionProps = {
    portalSummary: Record<string, unknown> | null;
    portalFetchBusy: boolean;
    licenseToken: string;
    onLicenseTokenChange: (value: string) => void;
    licenseStatus: LicenseStatus | null;
    licBusy: boolean;
    onVerifyLicense: () => void | Promise<void>;
    onActivateLicense: () => void | Promise<void>;
    canClearLicense?: boolean;
    onClearLicense?: () => void | Promise<void>;
};

export function EinstellungenLizenzSection({
    portalSummary,
    portalFetchBusy,
    licenseToken,
    onLicenseTokenChange,
    licenseStatus,
    licBusy,
    onVerifyLicense,
    onActivateLicense,
    canClearLicense = false,
    onClearLicense,
}: EinstellungenLizenzSectionProps) {
    const toast = useToastStore((s) => s.add);

    const activeV2 = licenseStatus?.valid ? licenseStatus.licenseV2 : null;
    const activeV1 = licenseStatus?.valid ? licenseStatus.license : null;

    const portalLicId =
        typeof portalSummary?.practice_slug === "string" && portalSummary.practice_slug.trim()
            ? `MD-PORTAL-${portalSummary.practice_slug.trim().toUpperCase()}`
            : "MD-PRO-DE-2026-0448-MR";
    const portalMaxUsers = typeof portalSummary?.max_users === "number" ? portalSummary.max_users : 8;
    const portalActiveUsers = typeof portalSummary?.active_users === "number" ? portalSummary.active_users : 4;
    const userBarPct = portalMaxUsers > 0 ? Math.min(100, Math.round((portalActiveUsers / portalMaxUsers) * 100)) : 50;
    const portalStorageGb = typeof portalSummary?.storage_gb === "number" ? portalSummary.storage_gb : 100;
    const portalStorageUsed = typeof portalSummary?.storage_used_gb === "number" ? portalSummary.storage_used_gb : 12.4;
    const storageBarPct =
        portalStorageGb > 0 ? Math.min(100, Math.round((portalStorageUsed / portalStorageGb) * 100)) : 12;
    const erUsed = typeof portalSummary?.erezept_month_used === "number" ? portalSummary.erezept_month_used : 142;
    const erQuota = typeof portalSummary?.erezept_month_quota === "number" ? portalSummary.erezept_month_quota : 0;
    const erLabel = erQuota > 0 ? `${erUsed} / ${erQuota}` : `${erUsed} / ∞`;
    const erBarPct = erQuota > 0 ? Math.min(100, Math.round((erUsed / erQuota) * 100)) : 8;

    const planTitle =
        typeof portalSummary?.plan_name === "string" && portalSummary.plan_name.trim()
            ? portalSummary.plan_name.trim()
            : null;

    return (
        <>
            <section className="settings-subcard settings-license-hero-wrap" style={{ overflow: "hidden", padding: 0 }}>
                <div className="settings-license-hero">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span className="settings-pill-accent">{portalFetchBusy ? "…" : licenseStatus?.valid ? "Aktiv" : "Inaktiv"}</span>
                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Ihr Plan</span>
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
                        {planTitle ?? (
                            <>
                                MeDoc Praxis <span style={{ color: "var(--accent)" }}>Pro</span>
                            </>
                        )}
                    </p>
                    <p className="card-sub" style={{ margin: "8px 0 0", maxWidth: "42rem" }}>
                        {portalSummary
                            ? `${typeof portalSummary.display_name === "string" ? portalSummary.display_name : "Praxis"} · bis zu ${portalMaxUsers} Behandler · Speicher bis ${portalStorageGb} GB · eRezept-Kontingent siehe unten`
                            : "Bis zu 8 Behandler · Unbegrenzt Patienten · eRezept · DATEV-Export · Premium Support (Beispiel — mit Hersteller-Portal werden Live-Daten geladen)"}
                    </p>
                    <div className="settings-license-hero__grid">
                        <div className="settings-license-metric">
                            Monatsgebühr
                            <strong>
                                {portalSummary ? formatEurFromCents(portalSummary.monthly_fee_cents) : "€ 189,00"}
                            </strong>
                        </div>
                        <div className="settings-license-metric">
                            Nächste Abbuchung
                            <strong>{portalSummary ? formatDeDateShort(portalSummary.next_billing_iso) : "01.05.2026"}</strong>
                        </div>
                        <div className="settings-license-metric">
                            Zahlungsmethode
                            <strong>{portalSummary ? "Im Abrechnungsportal" : "SEPA · · 4821"}</strong>
                        </div>
                    </div>
                    <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={async () => {
                                try {
                                    const url = await companyPortalBillingPortalUrl();
                                    window.open(url, "_blank", "noopener,noreferrer");
                                } catch {
                                    toast(
                                        "Hersteller-Portal nicht konfiguriert — Rechnungen ggf. im klassischen Abo-Portal.",
                                        "info",
                                    );
                                }
                            }}
                        >
                            Rechnungen
                        </Button>
                        <Button
                            type="button"
                            onClick={async () => {
                                try {
                                    const p = await openSubscriptionPortal();
                                    window.open(p.url, "_blank", "noopener,noreferrer");
                                } catch {
                                    toast(
                                        "Abo-Portal derzeit nicht verfügbar (offline oder nicht konfiguriert).",
                                        "info",
                                    );
                                }
                            }}
                        >
                            Plan wechseln
                        </Button>
                    </div>
                </div>
            </section>
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="card-title">Nutzung diesen Monat</div>
                </div>
                <div className="card-pad" style={{ display: "grid", gap: 16 }}>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>Aktive Behandler</span>
                            <span style={{ fontWeight: 650 }}>
                                {portalActiveUsers} / {portalMaxUsers}
                            </span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${userBarPct}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>Speicher</span>
                            <span style={{ fontWeight: 650 }}>
                                {portalStorageUsed} GB / {portalStorageGb} GB
                            </span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${storageBarPct}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>eRezepte / Monat</span>
                            <span style={{ fontWeight: 650 }}>{erLabel}</span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${erBarPct}%` }} />
                        </div>
                    </div>
                </div>
            </section>
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="card-title">Lizenz-Details</div>
                </div>
                <div className="settings-row" style={{ alignItems: "flex-start" }}>
                    <div>
                        <b>Lizenznummer</b>
                        <div className="settings-row-muted">{portalLicId}</div>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            void navigator.clipboard?.writeText(portalLicId).then(
                                () => toast("Kopiert", "success"),
                                () => toast("Kopieren nicht möglich", "error"),
                            );
                        }}
                    >
                        Kopieren
                    </Button>
                </div>
                <div className="settings-row">
                    <div>
                        <b>Desktop-Lizenz</b>
                        <div className="settings-row-muted">
                            {activeV2
                                ? `${activeV2.edition} · Gerät ${activeV2.deviceId.slice(0, 8)}… · ${activeV2.customerId}`
                                : activeV1
                                  ? `${activeV1.edition} · ${activeV1.customerId}`
                                  : "Keine gültige Lizenz hinterlegt"}
                        </div>
                    </div>
                    <span className={licenseStatus?.valid ? "settings-pill-green" : "settings-pill-gray"}>
                        {licenseStatus?.valid ? "Aktiv" : "Inaktiv"}
                    </span>
                </div>
                <div className="settings-row">
                    <div>
                        <b>KBV-Zulassung</b>
                        <div className="settings-row-muted">Zugelassen bis 31.12.2027</div>
                    </div>
                    <span className="settings-pill-green">Aktiv</span>
                </div>
                <div className="settings-row">
                    <div>
                        <b>Support-Vertrag</b>
                        <div className="settings-row-muted">Premium · 24/7 · Antwort unter 2h</div>
                    </div>
                    <span className="settings-chevron" aria-hidden>
                        <ChevronRightIcon size={18} />
                    </span>
                </div>
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    <Input
                        id="lic-token-card"
                        label="Lizenz-Token"
                        value={licenseToken}
                        onChange={(e) => onLicenseTokenChange(e.target.value)}
                        placeholder="v2.… oder v1-Token einfügen"
                    />
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={licBusy || !licenseToken.trim()}
                            loading={licBusy}
                            onClick={() => void onVerifyLicense()}
                        >
                            Prüfen
                        </Button>
                        <Button
                            type="button"
                            disabled={licBusy || !licenseToken.trim()}
                            loading={licBusy}
                            onClick={() => void onActivateLicense()}
                        >
                            Aktivieren
                        </Button>
                        {canClearLicense && licenseStatus?.valid && onClearLicense ? (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={licBusy}
                                loading={licBusy}
                                onClick={() => void onClearLicense()}
                            >
                                Lizenz entfernen
                            </Button>
                        ) : null}
                    </div>
                    {licenseStatus ? (
                        <p
                            style={{
                                color: licenseStatus.valid ? "var(--accent)" : "var(--red)",
                                margin: "8px 0 0",
                                fontSize: 13,
                            }}
                        >
                            {licenseStatus.valid
                                ? `Lizenz gültig (${licenseStatus.format ?? "?"})`
                                : `Ungültig: ${licenseStatus.reason ?? "Fehler"}`}
                        </p>
                    ) : null}
                </div>
            </section>
        </>
    );
}
