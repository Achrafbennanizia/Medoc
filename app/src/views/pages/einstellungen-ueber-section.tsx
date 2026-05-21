import { useEffect, useState } from "react";
import {
    attachPaymentMethod,
    checkForUpdates,
    currentAppVersion,
    openSubscriptionPortal,
    type LicenseStatus,
} from "@/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

export type EinstellungenUeberSectionProps = {
    licenseToken: string;
    onLicenseTokenChange: (value: string) => void;
    licenseStatus: LicenseStatus | null;
    licBusy: boolean;
    onVerifyLicense: () => void | Promise<void>;
};

export function EinstellungenUeberSection({
    licenseToken,
    onLicenseTokenChange,
    licenseStatus,
    licBusy,
    onVerifyLicense,
}: EinstellungenUeberSectionProps) {
    const toast = useToastStore((s) => s.add);
    const [appVersion, setAppVersion] = useState("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [aboutExpanded, setAboutExpanded] = useState(false);
    const [paymentToken, setPaymentToken] = useState("");
    const [paymentBusy, setPaymentBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        currentAppVersion()
            .then((v) => {
                if (!cancelled) setAppVersion(v);
            })
            .catch(() => {
                if (!cancelled) setAppVersion("?");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleCheckUpdates() {
        setUpdateBusy(true);
        try {
            const info = await checkForUpdates();
            toast(
                info.update_available
                    ? `Update verfügbar: ${info.latest_version}`
                    : `Aktuell auf neuester Version (${info.current_version})`,
                info.update_available ? "info" : "success",
            );
        } catch (e) {
            toast(`Update-Prüfung fehlgeschlagen: ${(e as Error).message ?? e}`, "error");
        } finally {
            setUpdateBusy(false);
        }
    }

    async function handleAttachPayment() {
        const token = paymentToken.trim();
        if (!token) return;
        setPaymentBusy(true);
        try {
            await attachPaymentMethod({ provider_token: token });
            toast("Zahlungsmethode hinterlegt", "success");
            setPaymentToken("");
        } catch (e) {
            toast(`Zahlungsmethode konnte nicht hinterlegt werden: ${(e as Error).message ?? e}`, "error");
        } finally {
            setPaymentBusy(false);
        }
    }

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Über die Anwendung</div>
                    <div className="card-sub">Version, Lizenz, Drittanbieter</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>App-Version</b>
                    <div className="card-sub">MeDoc {appVersion}</div>
                </div>
                <Button
                    variant="ghost"
                    type="button"
                    onClick={() => void handleCheckUpdates()}
                    disabled={updateBusy}
                    loading={updateBusy}
                >
                    Nach Updates suchen
                </Button>
            </div>
            <div className="settings-row" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div>
                    <b>Über &amp; Lizenzen</b>
                    <div className="card-sub">Kurzinfo und Symbol-Bibliotheken</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setAboutExpanded((v) => !v)}>
                    {aboutExpanded ? "Weniger anzeigen" : "Details anzeigen"}
                </Button>
            </div>
            {aboutExpanded ? (
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>MeDoc Praxisverwaltung</p>
                    <p style={{ color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                        Desktop-Anwendung für Termine, Patientenakten, Finanzen und Compliance — mit klarem Fokus auf
                        Datenschutz und Nachvollziehbarkeit.
                    </p>
                    <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>
                        Version <span className="font-mono">{appVersion}</span>
                    </p>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: "12px 0 0" }}>
                        Symbole:{" "}
                        <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                            Lucide
                        </a>{" "}
                        (ISC License).
                    </p>
                </div>
            ) : null}
            <div className="settings-highlight-card settings-lic-promo">
                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                    <span className="pill accent">Lizenz</span>
                    <span className="settings-lic-promo__meta">Token prüfen</span>
                </div>
                <p className="card-sub" style={{ margin: "8px 0 0" }}>Lizenz-Token zur Prüfung eingeben.</p>
                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={() => void onVerifyLicense()}
                        disabled={licBusy || !licenseToken.trim()}
                        loading={licBusy}
                    >
                        Jetzt prüfen
                    </Button>
                    <Button
                        type="button"
                        onClick={async () => {
                            const p = await openSubscriptionPortal();
                            window.open(p.url, "_blank", "noopener,noreferrer");
                        }}
                    >
                        Abo-Portal öffnen
                    </Button>
                </div>
            </div>
            <div className="card-pad">
                <Input
                    id="lic-token-inline"
                    label="Lizenz-Token"
                    value={licenseToken}
                    onChange={(e) => onLicenseTokenChange(e.target.value)}
                    placeholder="Token einfügen"
                />
                {licenseStatus ? (
                    <p style={{ color: licenseStatus.valid ? "var(--accent)" : "var(--red)", margin: "8px 0 0", fontSize: 13 }}>
                        {licenseStatus.valid ? "Lizenz gültig" : `Ungültig: ${licenseStatus.reason ?? "Fehler"}`}
                    </p>
                ) : null}
            </div>
            <div className="card-head" style={{ marginTop: 16 }}>
                <div>
                    <div className="card-title">Zahlungsmethode</div>
                    <div className="card-sub">Provider-Token (PCI-sicher)</div>
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12 }}>
                <div style={{ flex: 1 }}>
                    <Input
                        id="pay-token"
                        label="Provider-Token"
                        placeholder="pm_… oder tok_…"
                        value={paymentToken}
                        onChange={(e) => setPaymentToken(e.target.value)}
                    />
                </div>
                <Button
                    type="button"
                    onClick={() => void handleAttachPayment()}
                    disabled={paymentBusy || !paymentToken.trim()}
                    loading={paymentBusy}
                >
                    Hinterlegen
                </Button>
            </div>
            <div className="card-pad">
                <p className="card-sub" style={{ margin: 0, lineHeight: 1.55 }}>
                    <strong>Drittanbieter:</strong> Symbole über{" "}
                    <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                        Lucide
                    </a>{" "}
                    (ISC License). Weitere OSS-Bestandteile siehe mitgelieferte Dokumentation der Plattform (Tauri, React).
                </p>
            </div>
        </section>
    );
}
