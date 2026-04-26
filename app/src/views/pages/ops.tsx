import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createBackup,
    listBackups,
    importPatientsCsv,
    type BackupInfo,
    type ImportReport,
} from "../../controllers/ops.controller";
import {
    getPerfThresholdMs,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
} from "../../controllers/system.controller";
import { errorMessage } from "../../lib/utils";
import { Button } from "../components/ui/button";

export function OpsPage() {
    const navigate = useNavigate();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [csvPath, setCsvPath] = useState("");
    const [dryRun, setDryRun] = useState(true);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [health, setHealth] = useState<HealthCheck | null>(null);
    const [perfMs, setPerfMs] = useState("");
    const [perfSaved, setPerfSaved] = useState<string | null>(null);

    async function refresh() {
        setBackups(await listBackups());
    }
    useEffect(() => {
        refresh();
        getPerfThresholdMs()
            .then((ms) => setPerfMs(String(ms)))
            .catch(() => setPerfMs("500"));
    }, []);

    async function handleBackup() {
        setBusy(true); setMessage(null);
        try {
            const info = await createBackup();
            setMessage(`Backup erstellt: ${info.path} (${(info.size_bytes / 1024).toFixed(1)} KB)`);
            await refresh();
        } catch (e: unknown) {
            setMessage(`Fehler: ${errorMessage(e)}`);
        } finally { setBusy(false); }
    }

    async function handleImport() {
        if (!csvPath.trim()) return;
        setBusy(true); setMessage(null); setReport(null);
        try {
            const r = await importPatientsCsv(csvPath, dryRun);
            setReport(r);
        } catch (e: unknown) {
            setMessage(`Fehler: ${errorMessage(e)}`);
        } finally { setBusy(false); }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <h2 className="page-title">Betrieb &amp; Datenmanagement</h2>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">Datenmigration</h3>
                <p className="text-body text-on-surface-variant">
                    Geführter Assistent mit Checklisten für Umstieg oder Mandantenwechsel. Es werden keine Daten automatisch
                    importiert — nutzen Sie weiterhin Backup und CSV-Import nach Prüfung.
                </p>
                <Button type="button" variant="secondary" onClick={() => navigate("/migration")}>
                    Migrations-Assistent öffnen
                </Button>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">System-Selbsttest</h3>
                <p className="text-body text-on-surface-variant">
                    Prüft Datenbank, Audit-Kette und Protokollverzeichnis (ISO 13485 §7.5.1).
                </p>
                <Button
                    onClick={async () => {
                        setBusy(true);
                        try { setHealth(await systemHealthCheck()); }
                        finally { setBusy(false); }
                    }}
                    disabled={busy}
                >
                    Selbsttest ausführen
                </Button>
                {health && (
                    <ul className="text-body space-y-1" aria-live="polite">
                        <li>Version: <span className="font-mono">{health.version}</span></li>
                        <li>Datenbank: {health.db_ok ? "✓ OK" : "✗ FEHLER"} ({health.db_latency_ms} ms)</li>
                        <li>Audit-Kette: {health.audit_chain_ok ? "✓ Integrität OK" : `✗ Manipuliert bei ${health.audit_broken_at}`}</li>
                        <li>Log-Verzeichnis: {health.log_dir_writable ? "✓ beschreibbar" : "✗ nicht beschreibbar"}</li>
                    </ul>
                )}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">Performance (NFA-LOG-06)</h3>
                <p className="text-body text-on-surface-variant">
                    Schwellwert in Millisekunden: Aufrufe länger als dieser Wert erscheinen in{" "}
                    <code className="px-1">perf.log</code>. Standard: 500 ms.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-body">
                        <span className="text-caption text-on-surface-variant">Schwellwert (ms)</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={perfMs}
                            onChange={(e) => setPerfMs(e.target.value)}
                            className="w-40 px-3 py-2 bg-surface-container rounded-md text-body font-mono"
                        />
                    </label>
                    <Button
                        onClick={async () => {
                            const n = Number.parseInt(perfMs, 10);
                            if (!Number.isFinite(n) || n < 1) {
                                setMessage("Ungültiger Wert (min. 1 ms)");
                                return;
                            }
                            setBusy(true);
                            setPerfSaved(null);
                            try {
                                await setPerfThresholdMs(n);
                                setPerfSaved(`Gespeichert: ${n} ms`);
                            } catch (e: unknown) {
                                setMessage(`Fehler: ${errorMessage(e)}`);
                            } finally {
                                setBusy(false);
                            }
                        }}
                        disabled={busy}
                    >
                        Speichern
                    </Button>
                </div>
                {perfSaved && <p className="text-body text-accent-green">{perfSaved}</p>}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">Backup</h3>
                <p className="text-body text-on-surface-variant">
                    Erzeugt einen konsistenten Snapshot der Datenbank in
                    <code className="px-1">~/medoc-data/backups/</code>.
                </p>
                <Button onClick={handleBackup} disabled={busy}>
                    Backup jetzt erstellen
                </Button>
                {backups.length > 0 && (
                    <ul className="text-body font-mono space-y-1">
                        {backups.slice(0, 5).map((b) => (
                            <li key={b.path}>
                                {b.path} — {(b.size_bytes / 1024).toFixed(1)} KB
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">Patientenimport (CSV)</h3>
                <p className="text-body text-on-surface-variant">
                    Header: <code>name;geburtsdatum;geschlecht;versicherungsnummer;telefon;email;adresse</code>
                </p>
                <input
                    value={csvPath}
                    onChange={(e) => setCsvPath(e.target.value)}
                    placeholder="/Pfad/zur/patienten.csv"
                    className="w-full px-3 py-2 bg-surface-container rounded-md text-body"
                />
                <label className="flex items-center gap-2 text-body">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                    Trockenlauf (keine Daten schreiben)
                </label>
                <Button onClick={handleImport} disabled={busy || !csvPath.trim()}>
                    Import starten
                </Button>
                {report && (
                    <div className="text-body space-y-1">
                        <div>Gesamt: {report.total_rows}</div>
                        <div>Importiert: {report.imported}</div>
                        <div>Übersprungen: {report.skipped}</div>
                        <div>Fehlerhaft: {report.failed}</div>
                        {report.errors.length > 0 && (
                            <details>
                                <summary>Fehlerdetails ({report.errors.length})</summary>
                                <ul className="font-mono text-label mt-2">
                                    {report.errors.slice(0, 50).map((e, i) => (
                                        <li key={i}>{e}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
            </div>

            {message && <div className="card card-pad">{message}</div>}
        </div>
    );
}
