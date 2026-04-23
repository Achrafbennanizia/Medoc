import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { listZahlungen, getBilanz } from "../../controllers/zahlung.controller";
import type { Zahlung, Bilanz } from "../../models/types";
import { errorMessage, formatCurrency, formatDate } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

/**
 * Bilanz-Übersicht (FA-FIN-03 / FA-FIN-09 / FA-FIN-10).
 * Backend liefert Aggregate (Einnahmen, Ausstehend, Storniert).
 * Frontend ergänzt monatliche Aufschlüsselung aus Zahlungsliste.
 */
export function BilanzPage() {
    const [bilanz, setBilanz] = useState<Bilanz | null>(null);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [status, setStatus] = useState<"loading" | "ready">("loading");
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setStatus("loading");
        Promise.all([getBilanz(), listZahlungen()])
            .then(([b, z]) => {
                if (!cancelled) {
                    setBilanz(b);
                    setZahlungen(z);
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
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-headline text-on-primary">Bilanz</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader title="Einnahmen (bezahlt)" />
                    <p className="text-headline text-accent-green tabular-nums">{formatCurrency(bilanz.einnahmen)}</p>
                </Card>
                <Card>
                    <CardHeader title="Ausstehend" />
                    <p className="text-headline text-accent-yellow tabular-nums">{formatCurrency(bilanz.ausstehend)}</p>
                </Card>
                <Card>
                    <CardHeader title="Storniert" />
                    <p className="text-headline text-on-surface-variant tabular-nums">{formatCurrency(bilanz.storniert)}</p>
                </Card>
            </div>

            <Card>
                <CardHeader title="Monatlicher Verlauf (letzte 12 Monate)" />
                {byMonth.length === 0 ? (
                    <p className="text-body text-on-surface-variant">Noch keine Zahlungen erfasst.</p>
                ) : (
                    <ul className="space-y-2" role="list" aria-label="Monatsbilanz">
                        {byMonth.map(([month, v]) => (
                            <li key={month} className="text-body">
                                <div className="flex justify-between">
                                    <span className="font-mono text-on-surface-variant">{month}</span>
                                    <span className="text-accent-green">{formatCurrency(v.einnahmen)}</span>
                                </div>
                                <div className="h-2 mt-1 bg-surface-container rounded">
                                    <div
                                        className="h-2 bg-accent-green/60 rounded"
                                        style={{ width: `${(v.einnahmen / max) * 100}%` }}
                                        aria-hidden
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <CardHeader title="Letzte Zahlungen" />
                {zahlungen.length === 0 ? (
                    <p className="text-body text-on-surface-variant">Keine Zahlungen.</p>
                ) : (
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-2 py-2 text-label text-on-surface-variant">Datum</th>
                                <th className="text-left px-2 py-2 text-label text-on-surface-variant">Status</th>
                                <th className="text-right px-2 py-2 text-label text-on-surface-variant">Betrag</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zahlungen.slice(0, 20).map((z) => (
                                <tr key={z.id} className="border-b border-surface-container/30">
                                    <td className="px-2 py-2">{formatDate(z.created_at)}</td>
                                    <td className="px-2 py-2">{z.status}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(z.betrag)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
