import { useEffect, useState } from "react";
import {
    checkForUpdates,
    currentAppVersion,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

export function EinstellungenUeberSection() {
    const toast = useToastStore((s) => s.add);
    const [appVersion, setAppVersion] = useState("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [aboutExpanded, setAboutExpanded] = useState(false);

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

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Über die Anwendung</div>
                    <div className="card-sub">Version, Updates und Drittanbieter</div>
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
                    <b>Produktinfo</b>
                    <div className="card-sub">Kurzinfo zur Anwendung</div>
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
            <div className="card-pad">
                <p className="card-sub" style={{ margin: 0, lineHeight: 1.55 }}>
                    <strong>Drittanbieter:</strong> Symbole über{" "}
                    <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                        Lucide
                    </a>{" "}
                    (ISC License). Weitere OSS-Bestandteile siehe mitgelieferte Dokumentation der Plattform (Tauri, React).
                </p>
                <p className="card-sub" style={{ margin: "12px 0 0", lineHeight: 1.55 }}>
                    Lizenz, Abo und Zahlungsmethode finden Sie unter{" "}
                    <strong>Einstellungen → Lizenz &amp; Abo</strong>.
                </p>
            </div>
        </section>
    );
}
