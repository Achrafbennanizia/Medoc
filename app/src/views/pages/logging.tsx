import { useCallback, useEffect, useState } from "react";
import {
    getLogLevel,
    setLogLevel,
    exportLogs,
    verifyAuditChain,
    getLogDir,
    type LogLevel,
} from "../../controllers/logging.controller";
import { Button } from "../components/ui/button";
import { errorMessage } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

const LEVELS: LogLevel[] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

export function LoggingPage() {
    const [level, setLevel] = useState<LogLevel>("INFO");
    const [logDir, setLogDir] = useState<string>("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [initLoading, setInitLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);

    const loadMeta = useCallback(async () => {
        setInitLoading(true);
        setInitError(null);
        try {
            const [l, d] = await Promise.all([getLogLevel(), getLogDir()]);
            setLevel(l);
            setLogDir(d);
        } catch (e) {
            setInitError(errorMessage(e));
        } finally {
            setInitLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMeta();
    }, [loadMeta]);

    async function changeLevel(next: LogLevel) {
        try {
            await setLogLevel(next);
            setLevel(next);
            setMessage(`Log-Level auf ${next} gesetzt.`);
        } catch (e) {
            setMessage(`Level konnte nicht gesetzt werden: ${errorMessage(e)}`);
        }
    }

    async function handleExport() {
        setBusy(true);
        setMessage(null);
        try {
            const filename = `medoc-logs-${new Date().toISOString().slice(0, 10)}.zip`;
            const path = `${logDir.replace(/\/logs$/, "")}/${filename}`;
            const bytes = await exportLogs(path);
            setMessage(`Export erfolgreich: ${path} (${(bytes / 1024).toFixed(1)} KB)`);
        } catch (e: unknown) {
            setMessage(`Export fehlgeschlagen: ${errorMessage(e)}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleVerify() {
        setBusy(true);
        setMessage(null);
        try {
            const broken = await verifyAuditChain();
            setMessage(
                broken
                    ? `⚠ Audit-Kette gebrochen bei Eintrag ${broken}`
                    : "✓ Audit-Kette ist intakt."
            );
        } catch (e: unknown) {
            setMessage(`Prüfung fehlgeschlagen: ${errorMessage(e)}`);
        } finally {
            setBusy(false);
        }
    }

    if (initLoading) {
        return (
            <div className="animate-fade-in space-y-6">
                <h2 className="text-headline text-on-primary">Logs &amp; Observability</h2>
                <PageLoading label="Log-Einstellungen werden geladen…" />
            </div>
        );
    }
    if (initError) {
        return (
            <div className="animate-fade-in space-y-6">
                <h2 className="text-headline text-on-primary">Logs &amp; Observability</h2>
                <PageLoadError message={initError} onRetry={() => void loadMeta()} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-headline text-on-primary">Logs &amp; Observability</h2>

            <div className="card p-6 space-y-4">
                <h3 className="text-title">Log-Level</h3>
                <p className="text-body text-on-surface-variant">
                    Bestimmt die Detailtiefe der Anwendungs-Logs. Änderung wirkt sofort
                    ohne Neustart (NFA-LOG-10).
                </p>
                <div className="flex gap-2">
                    {LEVELS.map((l) => (
                        <button
                            key={l}
                            onClick={() => changeLevel(l)}
                            className={`px-4 py-2 rounded-md text-label ${level === l
                                    ? "bg-primary text-on-primary"
                                    : "bg-surface-container text-on-surface"
                                }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card p-6 space-y-4">
                <h3 className="text-title">Logverzeichnis</h3>
                <p className="text-body font-mono text-on-surface-variant">{logDir}</p>
            </div>

            <div className="card p-6 space-y-4">
                <h3 className="text-title">Logs exportieren</h3>
                <p className="text-body text-on-surface-variant">
                    Erstellt ein ZIP-Archiv der letzten 7 Tage aller Logdateien für
                    Support-Anfragen. Sensible Werte werden automatisch maskiert
                    (NFA-LOG-09).
                </p>
                <Button onClick={handleExport} disabled={busy}>
                    Logs als ZIP exportieren
                </Button>
            </div>

            <div className="card p-6 space-y-4">
                <h3 className="text-title">Audit-Log-Integrität</h3>
                <p className="text-body text-on-surface-variant">
                    Prüft die HMAC-Hash-Kette des Audit-Logs auf Manipulationen
                    (NFA-SEC-04++).
                </p>
                <Button onClick={handleVerify} disabled={busy}>
                    Integrität prüfen
                </Button>
            </div>

            {message && (
                <div className="card p-4 text-body">{message}</div>
            )}
        </div>
    );
}
