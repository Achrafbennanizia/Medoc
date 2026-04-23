import { useCallback, useEffect, useState } from "react";
import { getDashboardStats, type DashboardStats } from "../../controllers/statistik.controller";
import { errorMessage, formatCurrency } from "../../lib/utils";
import { Card } from "../components/ui/card";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function StatistikPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setStats(null);
        getDashboardStats()
            .then((s) => {
                if (!cancelled) setStats(s);
            })
            .catch((e) => {
                if (!cancelled) setLoadError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    if (loadError) return <PageLoadError message={loadError} onRetry={reload} />;
    if (!stats) return <PageLoading />;

    type Metric = { label: string; value: string; icon: string; accent: string };
    const metrics: Metric[] = [];
    if (stats.patienten_gesamt != null) {
        metrics.push({
            label: "Patienten gesamt",
            value: String(stats.patienten_gesamt),
            icon: "👥",
            accent: "text-primary",
        });
    }
    if (stats.termine_heute != null) {
        metrics.push({
            label: "Termine heute",
            value: String(stats.termine_heute),
            icon: "📅",
            accent: "text-accent-cyan",
        });
    }
    if (stats.einnahmen_monat != null) {
        metrics.push({
            label: "Einnahmen (Monat)",
            value: formatCurrency(stats.einnahmen_monat),
            icon: "💰",
            accent: "text-accent-green",
        });
    }
    if (stats.produkte_niedrig != null) {
        metrics.push({
            label: "Produkte niedrig",
            value: String(stats.produkte_niedrig),
            icon: "⚠️",
            accent: "text-accent-yellow",
        });
    }

    return (
        <div className="animate-fade-in">
            <h2 className="text-headline text-on-primary mb-2">Statistik</h2>
            <p className="text-body text-on-surface-variant mb-6 max-w-2xl">
                Aggregierte Kennzahlen für Auswertung, Controlling und Abrechnung — ergänzend zum operativen Dashboard.
            </p>

            {metrics.length === 0 ? (
                <p className="text-body text-on-surface-variant">
                    Für Ihre Rolle sind hier keine Kennzahlen freigeschaltet.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {metrics.map((m) => (
                        <Card key={m.label}>
                            <span className="text-2xl">{m.icon}</span>
                            <div className={`text-headline mt-2 ${m.accent}`}>{m.value}</div>
                            <div className="text-body text-on-surface-variant mt-1">{m.label}</div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
