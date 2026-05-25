import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    companyPortalBillingPortalUrl,
    companyPortalPing,
    getCompanyPortalConfig,
    setCompanyPortalConfig,
    type CompanyPortalConfig,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

function Mono({ children }: { children: ReactNode }) {
    return <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{children}</code>;
}

const EMPTY: CompanyPortalConfig = { base_url: "", practice_slug: "", api_key: "" };

export function EinstellungenCompanyPortalSection() {
    const toast = useToastStore((s) => s.add);
    const [cfg, setCfg] = useState<CompanyPortalConfig>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [pingBusy, setPingBusy] = useState(false);
    const [billingBusy, setBillingBusy] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [demoMode, setDemoMode] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const c = await getCompanyPortalConfig();
            setCfg({
                base_url: (c.base_url ?? "").trim(),
                practice_slug: (c.practice_slug ?? "").trim(),
                api_key: (c.api_key ?? "").trim(),
            });
        } catch (e) {
            toast(`Hersteller-Portal Konfiguration: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    }, [toast]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const saveCfg = async () => {
        setBusy(true);
        try {
            await setCompanyPortalConfig(cfg);
            toast("Hersteller-Portal gespeichert", "success");
            await refresh();
        } catch (e) {
            toast(`Speichern: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const ping = async () => {
        setPingBusy(true);
        try {
            const j = await companyPortalPing();
            setDemoMode(j._demo === true);
            toast(`Ping OK — ${JSON.stringify(j).slice(0, 120)}`, "success");
        } catch (e) {
            toast(`Ping: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setPingBusy(false);
        }
    };

    const openBilling = async () => {
        setBillingBusy(true);
        try {
            const url = await companyPortalBillingPortalUrl();
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (e) {
            toast(`Abrechnungsportal: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBillingBusy(false);
        }
    };

    return (
        <>
            {demoMode ? (
                <div
                    role="status"
                    className="card-pad"
                    style={{
                        marginTop: 12,
                        background: "var(--warning-bg, #fef9c3)",
                        border: "1px solid var(--warning-border, #eab308)",
                        borderRadius: 8,
                        color: "var(--warning-fg, #713f12)",
                        fontWeight: 600,
                    }}
                >
                    Demo-Modus — Antworten vom Hersteller-Server sind Stub-Daten (<code>_demo</code>).
                </div>
            ) : null}
            <div className="card-head" style={{ marginTop: 12 }}>
                <div>
                    <div className="card-title">Hersteller-Portal</div>
                    <div className="card-sub">
                        Anbindung an <Mono>medoc-company-server</Mono> (z.&nbsp;B. Port 9797) — Basis-URL, Praxis-Slug und API-Schlüssel.
                        Nur für Betrieb / System-Administratoren.
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 0 }}>
                <Input
                    id="cp-base-url"
                    label="Basis-URL"
                    value={cfg.base_url}
                    onChange={(e) => setCfg((c) => ({ ...c, base_url: e.target.value }))}
                    placeholder="http://127.0.0.1:9797"
                />
                <Input
                    id="cp-slug"
                    label="Praxis-Slug"
                    value={cfg.practice_slug}
                    onChange={(e) => setCfg((c) => ({ ...c, practice_slug: e.target.value }))}
                    placeholder="demo-praxis"
                />
                <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <Input
                            id="cp-api-key"
                            label="API-Schlüssel (Bearer)"
                            type={showKey ? "text" : "password"}
                            autoComplete="off"
                            value={cfg.api_key}
                            onChange={(e) => setCfg((c) => ({ ...c, api_key: e.target.value }))}
                            placeholder="sk_…"
                        />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowKey((v) => !v)}>
                        {showKey ? "Ausblenden" : "Anzeigen"}
                    </Button>
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Button type="button" onClick={() => void saveCfg()} loading={busy} disabled={busy}>
                        Speichern
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void ping()} loading={pingBusy} disabled={pingBusy}>
                        Verbindung testen
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void openBilling()} loading={billingBusy} disabled={billingBusy}>
                        Abrechnungsportal
                    </Button>
                </div>
                <p className="card-sub" style={{ margin: "12px 0 0", lineHeight: 1.5 }}>
                    <strong>Zahlungsmethode (Stripe&nbsp;<Mono>pm_</Mono> / <Mono>tok_</Mono>):</strong> unter{" "}
                    <strong>Über die Anwendung</strong> — derselbe Backend-Pfad <Mono>attach_payment_method</Mono> (Audit-Log), bei
                    vollständiger Portal-Konfiguration automatisch an den Hersteller.
                </p>
            </div>
        </>
    );
}
