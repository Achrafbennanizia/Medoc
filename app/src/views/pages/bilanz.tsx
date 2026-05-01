import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { Card, CardHeader } from "../components/ui/card";
import { listZahlungen, getBilanz } from "../../controllers/zahlung.controller";
import { listBilanzSnapshots, deleteBilanzSnapshot, type BilanzSnapshot } from "../../controllers/bilanz-snapshot.controller";
import type { Zahlung, Bilanz } from "../../models/types";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { useToastStore } from "../components/ui/toast-store";

/**
 * Bilanz-Übersicht (FA-FIN-03 / FA-FIN-09 / FA-FIN-10).
 * Backend liefert Aggregate (Einnahmen, Ausstehend, Storniert).
 * Frontend ergänzt monatliche Aufschlüsselung aus Zahlungsliste.
 */
export function BilanzPage() {
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canBackVerwaltung = role != null && allowed("personal.read", role);
    const [bilanz, setBilanz] = useState<Bilanz | null>(null);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [snapshots, setSnapshots] = useState<BilanzSnapshot[]>([]);
    const [snapshotDeleteId, setSnapshotDeleteId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [status, setStatus] = useState<"loading" | "ready">("loading");
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setStatus("loading");
        Promise.all([getBilanz(), listZahlungen(), listBilanzSnapshots()])
            .then(([b, z, snap]) => {
                if (!cancelled) {
                    setBilanz(b);
                    setZahlungen(z);
                    setSnapshots(snap);
                    setStatus("ready");
                }
            })
            .catch((e) => {
                if (!cancelled) setLoadError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    async function handleDeleteSnapshot() {
        if (!snapshotDeleteId) return;
        try {
            await deleteBilanzSnapshot(snapshotDeleteId);
            setSnapshots((list) => list.filter((s) => s.id !== snapshotDeleteId));
            toast("Snapshot gelöscht", "success");
        } catch (e) {
            toast(`Löschen fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setSnapshotDeleteId(null);
        }
    }

    const byMonth = useMemo(() => {
        const m = new Map<string, { einnahmen: number; ausstehend: number; storniert: number }>();
        for (const z of zahlungen) {
            const key = z.created_at.slice(0, 7); // YYYY-MM
            const cur = m.get(key) ?? { einnahmen: 0, ausstehend: 0, storniert: 0 };
            if (z.status === "BEZAHLT") cur.einnahmen += z.betrag;
            else if (z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT") cur.ausstehend += z.betrag;
            else if (z.status === "STORNIERT") cur.storniert += z.betrag;
            m.set(key, cur);
        }
        return Array.from(m.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 12);
    }, [zahlungen]);

    const max = Math.max(1, ...byMonth.map(([, v]) => v.einnahmen));

    if (loadError) {
        return <PageLoadError message={loadError} onRetry={reload} />;
    }
    if (status !== "ready" || !bilanz) {
        return <PageLoading label="Bilanz wird geladen…" />;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            {canBackVerwaltung ? (
                <div>
                    <VerwaltungBackButton />
                </div>
            ) : null}
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <h2 className="page-title" style={{ margin: 0 }}>Bilanz</h2>
                <Link to="/bilanz/neu" className="btn btn-subtle">Neuer Bilanz</Link>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                }}
            >
                <Card className="kpi">
                    <CardHeader title="Einnahmen (bezahlt)" />
                    <p className="kpi-val" style={{ color: "var(--accent-green)" }}>{formatCurrency(bilanz.einnahmen)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title="Ausstehend" />
                    <p className="kpi-val" style={{ color: "var(--accent-yellow)" }}>{formatCurrency(bilanz.ausstehend)}</p>
                </Card>
                <Card className="kpi">
                    <CardHeader title="Storniert" />
                    <p className="kpi-val" style={{ color: "var(--fg-3)" }}>{formatCurrency(bilanz.storniert)}</p>
                </Card>
            </div>

            <Card className="card-pad">
                <CardHeader title="Monatlicher Verlauf (letzte 12 Monate)" />
                {byMonth.length === 0 ? (
                    <p className="text-body text-on-surface-variant">Noch keine Zahlungen erfasst.</p>
                ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }} role="list" aria-label="Monatsbilanz">
                        {byMonth.map(([month, v]) => (
                            <li key={month}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-3)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{month}</span>
                                    <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>{formatCurrency(v.einnahmen)}</span>
                                </div>
                                <div style={{ marginTop: 6, height: 8, background: "var(--line)", borderRadius: 6 }}>
                                    <div
                                        className="bar"
                                        style={{ width: `${(v.einnahmen / max) * 100}%` }}
                                        aria-hidden
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="card-pad">
                <CardHeader title="Gespeicherte Bilanz-Snapshots" />
                {snapshots.length === 0 ? (
                    <p className="text-body text-on-surface-variant">
                        Noch keine Snapshots erfasst. Mit „Neuer Bilanz“ einen Abschluss erstellen.
                    </p>
                ) : (
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Erstellt</th>
                                <th>Label</th>
                                <th>Einnahmen</th>
                                <th>Ausgaben</th>
                                <th>Saldo</th>
                                <th aria-label="Aktionen" />
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((s) => (
                                <tr key={s.id}>
                                    <td>{formatDateTime(s.created_at)}</td>
                                    <td>{s.label}</td>
                                    <td>{formatCurrency(s.einnahmen_cents / 100)}</td>
                                    <td>{formatCurrency(s.ausgaben_cents / 100)}</td>
                                    <td style={{ color: s.saldo_cents >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                                        {formatCurrency(s.saldo_cents / 100)}
                                    </td>
                                    <td>
                                        <Button size="sm" variant="ghost" onClick={() => setSnapshotDeleteId(s.id)}>
                                            Löschen
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <ConfirmDialog
                open={!!snapshotDeleteId}
                onClose={() => setSnapshotDeleteId(null)}
                onConfirm={handleDeleteSnapshot}
                title="Snapshot löschen"
                message="Diesen Bilanz-Snapshot wirklich löschen? Die zugrundeliegenden Zahlungen bleiben erhalten."
                confirmLabel="Löschen"
                danger
            />

            <Card className="card-pad">
                <CardHeader title="Letzte Zahlungen" />
                {zahlungen.length === 0 ? (
                    <p className="text-body text-on-surface-variant">Keine Zahlungen.</p>
                ) : (
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Datum</th><th>Status</th><th>Betrag</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zahlungen.slice(0, 20).map((z) => (
                                <tr key={z.id}>
                                    <td>{formatDate(z.created_at)}</td>
                                    <td>{z.status}</td>
                                    <td>{formatCurrency(z.betrag)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
