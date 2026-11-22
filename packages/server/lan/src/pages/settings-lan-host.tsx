import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { lanSystem } from "@/systems/lan/adapters/tauri-lan.adapter";
import type {
    LanDiscoveryHitDto,
    LanServerConfigV1,
    LanServerStatusPayload,
} from "@/systems/practice-host/controllers/settings-page.controller";
import {
    EMPTY_LAN_CLIENT_CONFIG,
    isLanClientActive,
    loadLanClientConfig,
    saveLanClientConfig,
    type LanClientConfigV1,
} from "@/systems/lan/lib/lan-client-config";
import { resetPracticeTransportCache } from "@/systems/practice-host/adapters/practice-transport";
import { Button } from "@/views/components/ui/button";
import { DataTable } from "@/views/components/ui/data-table";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT } from "@/lib/i18n";
import { errorMessage, formatTpl, masterDeviceUnreachable } from "@/lib/utils";
import { Mono } from "@/views/components/ui/mono";

/** Inline switch matching Settings — duplicated minimally to avoid exporting private helper from settings.tsx */
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
    instanceLabel: "MeDoc Practice",
    autoStartWithApp: false,
};

export function SettingsLanHostSection({ embedded = false }: { embedded?: boolean } = {}) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const [cfg, setCfg] = useState<LanServerConfigV1>(DEFAULT_CFG);
    const [status, setStatus] = useState<LanServerStatusPayload | null>(null);
    const [busy, setBusy] = useState(false);
    const [scanBusy, setScanBusy] = useState(false);
    const [hits, setHits] = useState<LanDiscoveryHitDto[]>([]);
    const [scanFilter, setScanFilter] = useState("");
    const [lanClient, setLanClient] = useState<LanClientConfigV1>(EMPTY_LAN_CLIENT_CONFIG);
    const [showLanToken, setShowLanToken] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const [c, s] = await Promise.all([lanSystem.getConfig(), lanSystem.status()]);
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
            toast(formatTpl(t("page.lan.host.toast.load_err"), { error: errorMessage(e) }), "error");
        }
    }, [toast, t]);

    useEffect(() => {
        void refresh();
        setLanClient(loadLanClientConfig());
    }, [refresh]);

    useEffect(() => {
        const id = window.setInterval(() => void refresh(), 8000);
        return () => window.clearInterval(id);
    }, [refresh]);

    const saveCfg = async () => {
        setBusy(true);
        try {
            await lanSystem.setConfig(cfg);
            toast(t("page.lan.host.toast.config_saved"), "success");
            await refresh();
        } catch (e) {
            toast(formatTpl(t("page.lan.host.toast.save_err"), { error: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const start = async () => {
        setBusy(true);
        try {
            const s = await lanSystem.start();
            setStatus(s);
            toast(t("page.lan.host.toast.started"), "success");
        } catch (e) {
            const raw = errorMessage(e);
            const lower = raw.toLowerCase();
            if (lower.includes("lan listen is disabled") || lower.includes("do not run a lan server")) {
                return;
            }
            toast(
                masterDeviceUnreachable(raw)
                    ? t("page.lan.cluster_join.toast.connect_failed")
                    : formatTpl(t("page.lan.host.toast.start_err"), { error: raw }),
                "error",
            );
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await lanSystem.stop();
            await refresh();
            toast(t("page.lan.host.toast.stopped"), "success");
        } catch (e) {
            toast(formatTpl(t("page.lan.host.toast.stop_err"), { error: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const scan = async () => {
        setScanBusy(true);
        try {
            const h = await lanSystem.scan(scanFilter.trim() || undefined);
            setHits(h);
            toast(
                h.length
                    ? formatTpl(t("page.lan.host.toast.scan_found"), { count: h.length })
                    : t("page.lan.host.toast.scan_none"),
                "info",
            );
        } catch (e) {
            toast(formatTpl(t("page.lan.host.toast.scan_err"), { error: errorMessage(e) }), "error");
        } finally {
            setScanBusy(false);
        }
    };

    const saveLanClient = () => {
        saveLanClientConfig(lanClient);
        resetPracticeTransportCache();
        toast(
            isLanClientActive(lanClient)
                ? t("page.lan.host.toast.client_active")
                : t("page.lan.host.toast.client_inactive"),
            "success",
        );
    };

    const applyDiscoveryHit = (h: LanDiscoveryHitDto) => {
        const host = h.fromAddr.includes(":") ? h.fromAddr.split(":")[0]! : h.fromAddr;
        const base = `https://${host}:${h.httpPort}`;
        setLanClient((c) => ({ ...c, baseUrl: base }));
        toast(formatTpl(t("page.lan.host.toast.base_url_applied"), { url: base }), "info");
    };

    const running = status?.running ?? false;
    const lanClientOn = isLanClientActive(lanClient);

    const heading = (
        <>
            <div className="card-title">{t("page.lan.host.title")}</div>
            <div className="card-sub">
                {t("page.lan.host.subtitle_lead")} <strong>{t("page.lan.host.subtitle_mid")}</strong>{" "}
                {t("page.lan.host.subtitle_before_server")} <Mono>medoc-server</Mono>
                {t("page.lan.host.subtitle_after_server")}
            </div>
        </>
    );

    const body = (
        <>
            <div className="settings-row" style={{ alignItems: "flex-start", borderTop: "none", paddingTop: 0 }}>
                <div style={{ flex: 1 }}>
                    <b>{t("page.lan.host.server_status")}</b>
                    <div className="card-sub">
                        {running
                            ? formatTpl(t("page.lan.host.status_active"), {
                                  httpPort: status?.httpPort ?? "—",
                                  discoveryPort: status?.discoveryPort ?? "—",
                              })
                            : t("page.lan.host.status_stopped")}
                    </div>
                    {running && status?.tlsCertSha256 ? (
                        <div className="card-sub" style={{ marginTop: "var(--space-2)" }}>
                            <b>{t("page.lan.host.cert_sha256")}</b> <Mono>{status.tlsCertSha256}</Mono>
                        </div>
                    ) : null}
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
                <div className="row" style={{ gap: "var(--space-2)" }}>
                    <Button type="button" variant="secondary" loading={busy} disabled={busy || running} onClick={() => void start()}>
                        {t("page.lan.host.server_start")}
                    </Button>
                    <Button type="button" variant="ghost" loading={busy} disabled={busy || !running} onClick={() => void stop()}>
                        {t("page.lan.host.server_stop")}
                    </Button>
                </div>
            </div>

            <div className="card-head" style={{ marginTop: "var(--space-2)" }}>
                <div>
                    <div className="card-title">{t("page.lan.host.config_section")}</div>
                    <div className="card-sub">
                        <Mono>0.0.0.0</Mono> {t("page.lan.host.bind_hint_mid")} <Mono>127.0.0.1</Mono>
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "grid", gap: "var(--space-3)", maxWidth: 520 }}>
                <Input
                    id="lan-bind"
                    label={t("page.lan.host.label_bind")}
                    value={cfg.bindAddr}
                    onChange={(e) => setCfg({ ...cfg, bindAddr: e.target.value })}
                />
                <Input
                    id="lan-http"
                    label={t("page.lan.host.label_https")}
                    value={String(cfg.httpPort)}
                    onChange={(e) => setCfg({ ...cfg, httpPort: Number.parseInt(e.target.value, 10) || cfg.httpPort })}
                />
                <Input
                    id="lan-udp"
                    label={t("page.lan.host.label_udp")}
                    value={String(cfg.udpDiscoveryPort)}
                    onChange={(e) =>
                        setCfg({ ...cfg, udpDiscoveryPort: Number.parseInt(e.target.value, 10) || cfg.udpDiscoveryPort })
                    }
                />
                <Input
                    id="lan-label"
                    label={t("page.lan.host.label_beacon")}
                    value={cfg.instanceLabel}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setCfg({ ...cfg, instanceLabel: e.target.value })
                    }
                />
                <div className="settings-row">
                    <div>
                        <b>{t("page.lan.host.auto_start")}</b>
                        <div className="card-sub">{t("page.lan.host.auto_start_hint")}</div>
                    </div>
                    <Switch
                        ariaLabel={t("page.lan.host.auto_start_aria")}
                        checked={cfg.autoStartWithApp}
                        onChange={(next) => setCfg({ ...cfg, autoStartWithApp: next })}
                    />
                </div>
                <Button type="button" onClick={() => void saveCfg()} loading={busy} disabled={busy}>
                    {t("page.lan.host.config_save")}
                </Button>
            </div>

            <div className="card-head" style={{ marginTop: "var(--space-3)" }}>
                <div>
                    <div className="card-title">{t("page.lan.host.scan_section")}</div>
                    <div className="card-sub">{t("page.lan.host.scan_hint")}</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 220px" }}>
                    <Input
                        id="lan-scan-filter"
                        label={t("page.lan.host.label_scan_filter")}
                        value={scanFilter}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setScanFilter(e.target.value)}
                        placeholder={t("page.lan.host.scan_filter_ph")}
                    />
                </div>
                <Button type="button" variant="secondary" loading={scanBusy} disabled={scanBusy} onClick={() => void scan()}>
                    {t("page.lan.host.scan_btn")}
                </Button>
            </div>
            {hits.length ? (
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    <DataTable
                        label={t("page.lan.host.scan_btn")}
                        rows={hits}
                        getRowId={(h) => `${h.instanceId}-${h.fromAddr}`}
                        columns={[
                            { id: "source", header: t("page.lan.host.col_source"), width: "28%", truncate: true, text: (h) => h.fromAddr, cell: (h) => <span className="tbl-col-mono">{h.fromAddr}</span> },
                            { id: "https", header: t("page.lan.host.col_https"), width: "6rem", numeric: true, cell: (h) => h.httpPort },
                            { id: "label", header: t("page.lan.host.col_label"), truncate: true, text: (h) => h.label ?? "", cell: (h) => h.label },
                            { id: "version", header: t("page.lan.host.col_version"), width: "6.5rem", hideBelow: "sm", cell: (h) => h.version },
                            {
                                id: "action",
                                header: t("page.lan.host.scan_as_client"),
                                srOnlyHeader: true,
                                width: "11rem",
                                align: "end",
                                cell: (h) => (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => applyDiscoveryHit(h)}>
                                        {t("page.lan.host.scan_as_client")}
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </div>
            ) : null}

            <div className="card-head" style={{ marginTop: "var(--space-4)" }}>
                <div>
                    <div className="card-title">{t("page.lan.host.client_section")}</div>
                    <div className="card-sub">
                        {t("page.lan.host.client_hint")}
                        {lanClientOn ? (
                            <>
                                {" "}
                                <strong style={{ color: "var(--accent)" }}>{t("page.lan.host.client_active")}</strong>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "grid", gap: "var(--space-3)", maxWidth: 520 }}>
                <div className="settings-row">
                    <div>
                        <b>{t("page.lan.host.client_mode")}</b>
                        <div className="card-sub">{t("page.lan.host.client_mode_hint")}</div>
                    </div>
                    <Switch
                        ariaLabel={t("page.lan.host.client_mode_aria")}
                        checked={lanClient.enabled}
                        onChange={(next) => setLanClient({ ...lanClient, enabled: next })}
                    />
                </div>
                <Input
                    id="lan-client-base"
                    label={t("page.lan.host.client_base_url")}
                    value={lanClient.baseUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setLanClient({ ...lanClient, baseUrl: e.target.value.trim() })
                    }
                    placeholder="https://192.168.1.10:8787"
                />
                <Input
                    id="lan-client-token"
                    label={t("page.lan.host.client_jwt")}
                    type={showLanToken ? "text" : "password"}
                    value={lanClient.accessToken}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setLanClient({ ...lanClient, accessToken: e.target.value.trim() })
                    }
                    placeholder={t("page.lan.host.client_jwt_ph")}
                />
                <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <Button type="button" variant="secondary" onClick={() => setShowLanToken((version) => !version)}>
                        {showLanToken ? t("page.lan.host.hide_token") : t("page.lan.host.show_token")}
                    </Button>
                    <Button type="button" onClick={saveLanClient}>
                        {t("page.lan.host.client_save")}
                    </Button>
                </div>
                <p className="card-sub" style={{ margin: 0, lineHeight: 1.5 }}>
                    {t("page.lan.host.client_jwt_hint")}
                </p>
            </div>

            <div className="settings-highlight-card" style={{ marginTop: "var(--space-4)" }}>
                <div className="card-title" style={{ fontSize: 14 }}>
                    {t("page.lan.host.api_headline")}
                </div>
                <p className="card-sub" style={{ marginTop: "var(--space-2)", lineHeight: 1.55 }}>
                    {t("page.lan.host.api_routes")}
                </p>
                <p className="card-sub" style={{ marginTop: "var(--space-2)", lineHeight: 1.55 }}>
                    {t("page.lan.host.api_headless")}
                </p>
            </div>
        </>
    );

    if (embedded) {
        return (
            <div className="settings-system-block">
                <div className="settings-system-block__head">{heading}</div>
                <div className="settings-system-block__body">{body}</div>
            </div>
        );
    }

    return (
        <>
            <div className="card-head" style={{ marginTop: "var(--space-4)" }}>
                <div>{heading}</div>
            </div>
            {body}
        </>
    );
}
