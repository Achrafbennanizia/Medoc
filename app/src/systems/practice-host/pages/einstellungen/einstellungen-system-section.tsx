import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    createBackup,
    getPerfThresholdMs,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
} from "@/systems/practice-host/controllers/settings-page.controller";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import {
    loadDetectedPhotoViewerApps,
    photoViewerAppOptionsForSelect,
    OPEN_IMAGE_SYSTEM_ONLY,
    type DetectedPhotoViewerApp,
} from "@/lib/photo-viewer-apps";
import { EinstellungenCompanyPortalSection } from "@/systems/company-portal/pages/einstellungen-company-portal-section";
import { EinstellungenLanHostSection } from "@/systems/lan/pages/einstellungen-lan-host";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { Button } from "@/views/components/ui/button";
import { Input, Select } from "@/views/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

const LazyOpsPage = lazy(() =>
    import("@/views/pages/ops").then((m) => ({ default: m.OpsPage })),
);

function SettingsEmbeddedShell({ children }: { children: ReactNode }) {
    return (
        <div style={{ marginTop: 12, border: "1px solid var(--line-strong)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ maxHeight: "min(72vh, 840px)", overflow: "auto", padding: 12 }}>{children}</div>
        </div>
    );
}

function EmbedSuspenseFallback() {
    return (
        <div className="card-pad" style={{ color: "var(--fg-3)", fontSize: 13 }}>
            Modul wird geladen …
        </div>
    );
}

type AppearancePrefs = NonNullable<ClientSettingsV1["appearance"]>;
type SecurityPrefs = NonNullable<ClientSettingsV1["security"]>;
type AktePrefs = NonNullable<ClientSettingsV1["akte"]>;

export type EinstellungenSystemSectionProps = {
    appearance: AppearancePrefs;
    security: SecurityPrefs;
    akteClient: AktePrefs;
    canLanHost: boolean;
    canMigration: boolean;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
    onHealthLastChange?: (health: HealthCheck | null) => void;
};

export function EinstellungenSystemSection({
    appearance,
    security,
    akteClient,
    canLanHost,
    canMigration,
    onPersistClient,
    onHealthLastChange,
}: EinstellungenSystemSectionProps) {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [healthLast, setHealthLast] = useState<HealthCheck | null>(null);
    const [healthBusy, setHealthBusy] = useState(false);
    const [perfMs, setPerfMs] = useState("");
    const [perfBusy, setPerfBusy] = useState(false);
    const [backupBusy, setBackupBusy] = useState(false);
    const [opsEmbed, setOpsEmbed] = useState(false);
    const [photoViewerApps, setPhotoViewerApps] = useState<DetectedPhotoViewerApp[]>([]);

    useEffect(() => {
        let cancelled = false;
        void loadDetectedPhotoViewerApps(true)
            .then((apps) => {
                if (!cancelled) setPhotoViewerApps(apps);
            })
            .catch((e) => {
                if (!cancelled) {
                    toast(`Foto-Viewer-Apps konnten nicht ermittelt werden: ${errorMessage(e)}`, "warning");
                }
            });
        getPerfThresholdMs()
            .then((ms) => {
                if (!cancelled) setPerfMs(String(ms));
            })
            .catch((e) => {
                if (!cancelled) {
                    setPerfMs("");
                    toast(`Performance-Schwellwert konnte nicht geladen werden: ${errorMessage(e)}`, "warning");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [toast]);

    const photoAppSelectOptions = useMemo(() => {
        const opts = photoViewerAppOptionsForSelect(photoViewerApps);
        const cur = (akteClient.openImagesWithApp ?? "").trim();
        if (cur && cur !== OPEN_IMAGE_SYSTEM_ONLY && !opts.some((o) => o.value === cur)) {
            return [...opts, { value: cur, label: `Gespeichert: ${cur}` }];
        }
        return opts;
    }, [photoViewerApps, akteClient.openImagesWithApp]);

    async function runHealthCheck() {
        setHealthBusy(true);
        try {
            const h = await systemHealthCheck();
            setHealthLast(h);
            onHealthLastChange?.(h);
            toast(
                h.db_ok && h.audit_chain_ok ? "System-Check: OK" : "System-Check: siehe Kurzinfo",
                h.db_ok && h.audit_chain_ok ? "success" : "info",
            );
        } catch (e) {
            toast(`Health-Check fehlgeschlagen: ${(e as Error).message ?? e}`, "error");
        } finally {
            setHealthBusy(false);
        }
    }

    async function savePerfThreshold() {
        const n = Number.parseInt(perfMs, 10);
        if (!Number.isFinite(n) || n < 50 || n > 60_000) {
            toast("Performance-Schwelle: Zahl zwischen 50 und 60000 ms", "error");
            return;
        }
        setPerfBusy(true);
        try {
            await setPerfThresholdMs(n);
            toast("Performance-Schwelle gespeichert", "success");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setPerfBusy(false);
        }
    }

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">System</div>
                    <div className="card-sub">Diagnose, Performance, Daten</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Benutzeravatar in der Kopfleiste</b>
                    <div className="card-sub">Kreis mit Initialen rechts oben</div>
                </div>
                <SettingsSwitch
                    ariaLabel="Benutzeravatar in der Kopfleiste"
                    checked={appearance.showHeaderAvatar !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                            const on = a.showHeaderAvatar !== false;
                            return mergeClientSettingsPatch(c, { appearance: { ...a, showHeaderAvatar: on ? false : true } });
                        })
                    }
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>Tastenkürzel anzeigen</b>
                    <div className="card-sub">z. B. ⌘K in der Suche</div>
                </div>
                <SettingsSwitch
                    ariaLabel="Tastenkürzel anzeigen"
                    checked={appearance.showKeyboardHints !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                            const on = a.showKeyboardHints !== false;
                            return mergeClientSettingsPatch(c, { appearance: { ...a, showKeyboardHints: on ? false : true } });
                        })
                    }
                />
            </div>
            <div className="card-head" style={{ marginTop: 4 }}>
                <div>
                    <div className="card-title">Akten-Anlagen</div>
                    <div className="card-sub">Programm für „Extern öffnen…“ in der Patientenakte</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 0 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                    <p className="card-sub" style={{ margin: 0, flex: "1 1 220px" }}>
                        Es werden nur auf diesem Rechner installierte Programme angezeigt. Leer = erste gefundene App; „Nur
                        Systemstandard“ = wie Doppelklick im Finder.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                            void loadDetectedPhotoViewerApps(true).then((a) => {
                                setPhotoViewerApps(a);
                                toast(`${a.length} Viewer gefunden`, "info");
                            })
                        }
                    >
                        Neu scannen
                    </Button>
                </div>
                <Select
                    id="set-akte-open-app"
                    label="App zum externen Öffnen"
                    value={akteClient.openImagesWithApp ?? ""}
                    options={photoAppSelectOptions}
                    onChange={(e) =>
                        onPersistClient((c) => {
                            const ak = c.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;
                            return mergeClientSettingsPatch(c, {
                                akte: { ...ak, openImagesWithApp: e.target.value },
                            });
                        })
                    }
                />
            </div>
            <div className="card-head" style={{ marginTop: 12 }}>
                <div>
                    <div className="card-title">Sitzung &amp; Diagnose</div>
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                    <b>Auto-Abmeldung bei Inaktivität</b>
                    <div className="card-sub">Nur auf diesem Gerät; 0 = aus. Bei Ablauf wird abgemeldet (wie Abmelden).</div>
                </div>
                <div style={{ minWidth: 160 }}>
                    <Select
                        label="Minuten"
                        value={String(security.idleLogoutMinutes ?? 0)}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                const n = Number.parseInt(e.target.value, 10);
                                return mergeClientSettingsPatch(c, {
                                    security: { ...s, idleLogoutMinutes: Number.isFinite(n) ? n : 0 },
                                });
                            })
                        }
                        options={[
                            { value: "0", label: "Aus" },
                            { value: "5", label: "5" },
                            { value: "15", label: "15" },
                            { value: "30", label: "30" },
                            { value: "60", label: "60" },
                        ]}
                    />
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Health-Check</b>
                    <div className="card-sub">
                        {healthLast
                            ? `DB ${healthLast.db_ok ? "OK" : "Fehler"} (${healthLast.db_latency_ms} ms) · Audit ${healthLast.audit_chain_ok ? "OK" : "Bruch"} · v${healthLast.version}`
                            : "Datenbank, Audit-Kette"}
                    </div>
                </div>
                <Button type="button" variant="secondary" loading={healthBusy} disabled={healthBusy} onClick={() => void runHealthCheck()}>
                    Prüfen
                </Button>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                    <Input id="perf-ms" label="Performance-Schwelle (ms)" value={perfMs} onChange={(e) => setPerfMs(e.target.value)} />
                    <span className="card-sub">Langsame Tauri-Aufrufe über dieser Zeit werden protokolliert</span>
                </div>
                <Button type="button" onClick={() => void savePerfThreshold()} loading={perfBusy} disabled={perfBusy}>
                    Speichern
                </Button>
            </div>
            {canLanHost ? <EinstellungenLanHostSection /> : null}
            {canLanHost ? <EinstellungenCompanyPortalSection /> : null}
            <div className="card-head" style={{ marginTop: 12 }}>
                <div>
                    <div className="card-title">Backup</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Backup jetzt</b>
                    <div className="card-sub">In konfiguriertes Ziel (Ops)</div>
                </div>
                <Button
                    type="button"
                    loading={backupBusy}
                    disabled={backupBusy}
                    onClick={async () => {
                        setBackupBusy(true);
                        try {
                            await createBackup();
                            toast("Backup wurde erstellt.", "success");
                        } catch (e) {
                            toast(`Backup fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
                        } finally {
                            setBackupBusy(false);
                        }
                    }}
                >
                    Jetzt sichern
                </Button>
            </div>
            <div className="card-head" style={{ marginTop: 12 }}>
                <div>
                    <div className="card-title">Weitere Seiten</div>
                </div>
            </div>
            <div className="card-pad row" style={{ gap: 10, flexWrap: "wrap" }}>
                <Link to="/hilfe" className="btn btn-subtle">
                    Hilfe
                </Link>
                <Link to="/compliance" className="btn btn-subtle">
                    Compliance
                </Link>
                <Link to="/audit" className="btn btn-subtle">
                    Audit-Log
                </Link>
                <Link to="/logs" className="btn btn-subtle">
                    Technische Logs
                </Link>
                <Link to="/ops" className="btn btn-subtle">
                    Betrieb / Ops
                </Link>
                {canMigration ? (
                    <Link to="/migration" className="btn btn-subtle">
                        Datenmigration
                    </Link>
                ) : null}
                <Button type="button" variant={opsEmbed ? "secondary" : "ghost"} onClick={() => setOpsEmbed((v) => !v)}>
                    Ops-Vorschau {opsEmbed ? "ausblenden" : "einblenden"}
                </Button>
            </div>
            {opsEmbed ? (
                <Suspense fallback={<EmbedSuspenseFallback />}>
                    <SettingsEmbeddedShell>
                        <LazyOpsPage embedded onOpenMigration={() => navigate("/migration")} />
                    </SettingsEmbeddedShell>
                </Suspense>
            ) : null}
        </section>
    );
}
