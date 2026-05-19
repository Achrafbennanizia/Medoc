import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    lanServerGetConfig,
    lanServerScan,
    lanServerSetConfig,
    lanServerStart,
    lanServerStatus,
    lanServerStop,
    type LanDiscoveryHitDto,
    type LanServerConfigV1,
    type LanServerStatusPayload,
} from "@/controllers/settings-page.controller";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";

/** Inline switch matching Einstellungen — duplicated minimally to avoid exporting private helper from einstellungen.tsx */
function Switch({
    checked,
    onChange,
    ariaLabel,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            className={`settings-switch${checked ? " settings-switch--on" : ""}`}
            onClick={() => onChange(!checked)}
        >
            <span className="settings-switch__thumb" aria-hidden />
        </button>
    );
}

const DEFAULT_CFG: LanServerConfigV1 = {
    schemaVersion: 1,
    bindAddr: "0.0.0.0",
    httpPort: 8787,
    udpDiscoveryPort: 47830,
    instanceLabel: "MeDoc Praxis",
    autoStartWithApp: false,
};

function Mono({ children }: { children: ReactNode }) {
    return (
        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{children}</code>
    );
}

export function EinstellungenLanHostSection() {
    const toast = useToastStore((s) => s.add);
    const [cfg, setCfg] = useState<LanServerConfigV1>(DEFAULT_CFG);
    const [status, setStatus] = useState<LanServerStatusPayload | null>(null);
    const [busy, setBusy] = useState(false);
    const [scanBusy, setScanBusy] = useState(false);
    const [hits, setHits] = useState<LanDiscoveryHitDto[]>([]);
    const [scanFilter, setScanFilter] = useState("");

    const refresh = useCallback(async () => {
        try {
            const [c, s] = await Promise.all([lanServerGetConfig(), lanServerStatus()]);
            setCfg({
                schemaVersion: c.schemaVersion ?? 1,
                bindAddr: c.bindAddr ?? DEFAULT_CFG.bindAddr,
                httpPort: c.httpPort ?? DEFAULT_CFG.httpPort,
                udpDiscoveryPort: c.udpDiscoveryPort ?? DEFAULT_CFG.udpDiscoveryPort,
                instanceLabel: c.instanceLabel ?? DEFAULT_CFG.instanceLabel,
                autoStartWithApp: Boolean(c.autoStartWithApp),
            });
            setStatus(s);
        } catch (e) {
            toast(`LAN-Einstellungen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    }, [toast]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const id = window.setInterval(() => void refresh(), 8000);
        return () => window.clearInterval(id);
    }, [refresh]);

    const saveCfg = async () => {
        setBusy(true);
        try {
            await lanServerSetConfig(cfg);
            toast("LAN-Konfiguration gespeichert", "success");
            await refresh();
        } catch (e) {
            toast(`Speichern: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const start = async () => {
        setBusy(true);
        try {
            const s = await lanServerStart();
            setStatus(s);
            toast("LAN-Server gestartet", "success");
        } catch (e) {
            toast(`Start: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await lanServerStop();
            await refresh();
            toast("LAN-Server gestoppt", "success");
        } catch (e) {
            toast(`Stopp: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const scan = async () => {
        setScanBusy(true);
        try {
            const h = await lanServerScan(scanFilter.trim() || undefined);
            setHits(h);
            toast(h.length ? `${h.length} Host(s) im LAN gefunden` : "Keine Antworten (Firewall prüfen)", "info");
        } catch (e) {
            toast(`Scan: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setScanBusy(false);
        }
    };

    const running = status?.running ?? false;

    return (
        <>
            <div className="card-head" style={{ marginTop: 16 }}>
                <div>
                    <div className="card-title">LAN-Host / Zweitgeräte</div>
                    <div className="card-sub">
                        Stellt dieselbe SQLite-Datenbank authentifiziert per HTTP im lokalen Netz bereit — für einen zweiten PC,
                        Tablet oder das Headless-Binary <Mono>medoc-server</Mono>. Ohne TLS: nur im
                        vertrauenswürdigen LAN einsetzen; Zugriff über Anmeldung (JWT).
                    </div>
                </div>
            </div>

            <div className="settings-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                    <b>Serverstatus</b>
                    <div className="card-sub">
                        {running
                            ? `Aktiv · HTTP ${status?.httpPort ?? "—"} · UDP-Suche ${status?.discoveryPort ?? "—"}`
                            : "Gestoppt — starten Sie den Dienst, wenn Zweitgeräte diesen Rechner als Host nutzen sollen."}
                    </div>
                    {running && status?.suggestedBaseUrls?.length ? (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--fg-2)" }}>
                            {status.suggestedBaseUrls.slice(0, 6).map((u) => (
                                <li key={u}>
                                    <Mono>{u}</Mono>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                <div className="row" style={{ gap: 8 }}>
                    <Button type="button" variant="secondary" loading={busy} disabled={busy || running} onClick={() => void start()}>
                        Starten
                    </Button>
                    <Button type="button" variant="ghost" loading={busy} disabled={busy || !running} onClick={() => void stop()}>
                        Stoppen
                    </Button>
                </div>
            </div>

            <div className="card-head" style={{ marginTop: 8 }}>
                <div>
                    <div className="card-title">Konfiguration</div>
                    <div className="card-sub">
                        <Mono>0.0.0.0</Mono> = alle Netzwerkschnittstellen; für nur diesen Rechner ohne LAN-Zugriff:{" "}
                        <Mono>127.0.0.1</Mono>
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "grid", gap: 12, maxWidth: 520 }}>
                <Input
                    id="lan-bind"
                    label="Bind-Adresse (TCP)"
                    value={cfg.bindAddr}
                    onChange={(e) => setCfg({ ...cfg, bindAddr: e.target.value })}
                />
                <Input
                    id="lan-http"
                    label="HTTP-Port"
                    value={String(cfg.httpPort)}
                    onChange={(e) => setCfg({ ...cfg, httpPort: Number.parseInt(e.target.value, 10) || cfg.httpPort })}
                />
                <Input
                    id="lan-udp"
                    label="UDP-Suche (Discovery)"
                    value={String(cfg.udpDiscoveryPort)}
                    onChange={(e) =>
                        setCfg({ ...cfg, udpDiscoveryPort: Number.parseInt(e.target.value, 10) || cfg.udpDiscoveryPort })
                    }
                />
                <Input
                    id="lan-label"
                    label="Anzeigename (Beacon)"
                    value={cfg.instanceLabel}
                    onChange={(e) => setCfg({ ...cfg, instanceLabel: e.target.value })}
                />
                <div className="settings-row">
                    <div>
                        <b>Mit App starten</b>
                        <div className="card-sub">Server ca. 1,5 s nach Start automatisch anbinden</div>
                    </div>
                    <Switch
                        ariaLabel="LAN-Server mit App starten"
                        checked={cfg.autoStartWithApp}
                        onChange={(next) => setCfg({ ...cfg, autoStartWithApp: next })}
                    />
                </div>
                <Button type="button" onClick={() => void saveCfg()} loading={busy} disabled={busy}>
                    Konfiguration speichern
                </Button>
            </div>

            <div className="card-head" style={{ marginTop: 12 }}>
                <div>
                    <div className="card-title">LAN durchsuchen</div>
                    <div className="card-sub">UDP-Broadcast — andere Geräte mit laufendem MeDoc-Host antworten kurz (Firewall/Gäste-WLAN beachten).</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 220px" }}>
                    <Input
                        id="lan-scan-filter"
                        label="Label enthält (optional)"
                        value={scanFilter}
                        onChange={(e) => setScanFilter(e.target.value)}
                        placeholder="z. B. Praxis"
                    />
                </div>
                <Button type="button" variant="secondary" loading={scanBusy} disabled={scanBusy} onClick={() => void scan()}>
                    Jetzt suchen (ca. 2,5 s)
                </Button>
            </div>
            {hits.length ? (
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th align="left">Quelle</th>
                                <th align="left">HTTP</th>
                                <th align="left">Label</th>
                                <th align="left">Version</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hits.map((h) => (
                                <tr key={`${h.instanceId}-${h.fromAddr}`}>
                                    <td>{h.fromAddr}</td>
                                    <td>{h.httpPort}</td>
                                    <td>{h.label}</td>
                                    <td>{h.version}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            <div className="settings-highlight-card" style={{ marginTop: 14 }}>
                <div className="card-title" style={{ fontSize: 14 }}>
                    API (Kurzüberblick)
                </div>
                <p className="card-sub" style={{ marginTop: 8, lineHeight: 1.55 }}>
                    <Mono>GET /health</Mono> · <Mono>GET /api/v1/ping</Mono> · <Mono>POST /api/v1/auth/login</Mono> (JSON mit email/passwort)
                    · geschützt: <Mono>Authorization: Bearer …</Mono> für <Mono>GET /api/v1/patienten</Mono>,{" "}
                    <Mono>GET /api/v1/termine?datum=YYYY-MM-DD</Mono>, Praxis-KV wie in der App:{" "}
                    <Mono>GET /api/v1/app-kv?key=…</Mono>, <Mono>PUT /api/v1/app-kv</Mono> <Mono>{"{ key, value }"}</Mono>,{" "}
                    <Mono>DELETE /api/v1/app-kv?key=…</Mono> (gleiche Schlüssel/RBAC wie Tauri <Mono>get_app_kv</Mono>).
                </p>
                <p className="card-sub" style={{ marginTop: 8, lineHeight: 1.55 }}>
                    Headless: Binary <Mono>medoc-server --data-dir …</Mono> — Verzeichnis muss dieselbe <Mono>medoc.db</Mono> wie diese
                    Installation verwenden.
                </p>
            </div>
        </>
    );
}
