import { useCallback, useEffect, useState } from "react";
import { getDashboardStats, type DashboardStats } from "../../controllers/statistik.controller";
import { listUpcomingAppointments, type UpcomingAppointment } from "../../controllers/integration.controller";
import { errorMessage, formatCurrency } from "../../lib/utils";
import { Card } from "../components/ui/card";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [reminders, setReminders] = useState<UpcomingAppointment[]>([]);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        setStatsError(null);
        setStats(null);
        getDashboardStats()
            .then((s) => {
                if (!cancelled) setStats(s);
            })
            .catch((e) => {
                if (!cancelled) setStatsError(errorMessage(e));
            });
        listUpcomingAppointments(24 * 60)
            .then((r) => {
                if (!cancelled) setReminders(r);
            })
            .catch(() => {
                if (!cancelled) setReminders([]);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    if (statsError) {
        return <PageLoadError message={statsError} onRetry={reload} />;
    }
    if (!stats) {
        return <PageLoading />;
    }

    const cards = [
        stats.patienten_gesamt != null && {
            label: "Patienten gesamt",
            value: String(stats.patienten_gesamt),
            icon: "👥",
            accent: "text-primary",
        },
        stats.termine_heute != null && {
            label: "Termine heute",
            value: String(stats.termine_heute),
            icon: "📅",
            accent: "text-accent-cyan",
        },
        stats.einnahmen_monat != null && {
            label: "Einnahmen (Monat)",
            value: formatCurrency(stats.einnahmen_monat as number),
            icon: "💰",
            accent: "text-accent-green",
        },
        stats.produkte_niedrig != null && {
            label: "Produkte niedrig",
            value: String(stats.produkte_niedrig),
            icon: "⚠️",
            accent: "text-accent-yellow",
        },
    ].filter((c): c is { label: string; value: string; icon: string; accent: string } => Boolean(c));

    return (
        <div className="animate-fade-in">
            <h2 className="text-headline text-on-primary mb-6">Dashboard</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.length === 0 ? (
                    <Card className="sm:col-span-2 lg:col-span-4">
                        <p className="text-body text-on-surface-variant">
                            Für Ihre Rolle sind hier keine Kennzahlen hinterlegt.
                        </p>
                    </Card>
                ) : null}
                {cards.map((card) => (
                    <Card key={card.label} className="hover:bg-surface-container transition-colors duration-150">
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl">{card.icon}</span>
                        </div>
                        <div className={`text-headline ${card.accent}`}>{card.value}</div>
                        <div className="text-body text-on-surface-variant mt-1">{card.label}</div>
                    </Card>
                ))}
            </div>

            <section className="mt-8" aria-labelledby="reminders-heading">
                <h3 id="reminders-heading" className="text-title text-on-primary mb-3">
                    Anstehende Termine (24 h)
                </h3>
                {reminders.length === 0 ? (
                    <Card>
                        <p className="text-body text-on-surface-variant">
                            Keine Termine in den nächsten 24 Stunden.
                        </p>
                    </Card>
                ) : (
                    <Card>
                        <ul className="divide-y divide-surface-bright/50">
                            {reminders.map((r) => (
                                <li key={r.termin_id} className="py-2 flex items-center justify-between">
                                    <div>
                                        <div className="text-body-medium text-on-surface">{r.patient_name}</div>
                                        <div className="text-caption text-on-surface-variant">
                                            {r.datum} {r.uhrzeit} — {r.art}
                                        </div>
                                    </div>
                                    <span className="text-caption text-accent-cyan">
                                        in {Math.max(0, Math.round(r.minutes_until / 60))} h
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </section>
        </div>
    );
}
