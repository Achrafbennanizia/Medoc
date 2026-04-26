import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getDashboardStats, type DashboardStats } from "../../controllers/statistik.controller";
import { listTermine } from "../../controllers/termin.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { errorMessage, formatCurrency } from "../../lib/utils";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Termin } from "../../models/types";
import { FilterIcon, NAV_ICONS, PlusIcon, SparkleIcon } from "@/lib/icons";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { useT } from "@/lib/i18n";

function terminStatusLabel(status: string): string {
    const map: Record<string, string> = {
        GEPLANT: "Geplant",
        BESTAETIGT: "Bestätigt",
        DURCHGEFUEHRT: "Durchgeführt",
        NICHT_ERSCHIENEN: "Nicht erschienen",
        ABGESAGT: "Abgesagt",
    };
    return map[status] ?? status;
}

export function DashboardPage() {
    const t = useT();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [termine, setTermine] = useState<Termin[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);
    const session = useAuthStore((s) => s.session);
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

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
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([listTermine(), listPatienten()])
            .then(([t, p]) => {
                if (!cancelled) {
                    setTermine(t);
                    setPatienten(p);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTermine([]);
                    setPatienten([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    const todayIso = format(new Date(), "yyyy-MM-dd");
    const patientNameById = useMemo(() => new Map(patienten.map((p) => [p.id, p.name])), [patienten]);

    const heuteTermine = useMemo(() => {
        return termine
            .filter((x) => x.datum === todayIso && x.status !== "ABGESAGT")
            .sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit));
    }, [termine, todayIso]);

    if (statsError) {
        return <PageLoadError message={statsError} onRetry={reload} />;
    }
    if (!stats) {
        return <PageLoading />;
    }

    const today = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }} className="animate-fade-in dashboard-page">
            <div className="page-head" style={{ alignItems: "center" }}>
                <div>
                    <h1 className="page-title">Guten Morgen, {session?.name ?? "Team"}</h1>
                    <div className="page-sub">
                        {today} · {stats.termine_heute ?? 0} {t("dashboard.termine_heute_sub")}
                    </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-subtle" onClick={() => navigate("/statistik")}><FilterIcon />{t("dashboard.filter_stats")}</button>
                    <button type="button" className="btn btn-accent" onClick={() => navigate("/patienten/neu")}><PlusIcon />{t("dashboard.new_action")}</button>
                </div>
            </div>
            <div className="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {stats.patienten_gesamt != null && (
                    <StatCard
                        label={t("dashboard.kpi.patienten_gesamt")}
                        value={String(stats.patienten_gesamt)}
                        icon="Users"
                        accent="#0EA07E"
                        sub={t("dashboard.kpi.patienten_gesamt_sub")}
                        trend="neutral"
                    />
                )}
                {stats.termine_heute != null && (
                    <StatCard
                        label={t("dashboard.kpi.termine_heute")}
                        value={String(stats.termine_heute)}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={t("dashboard.kpi.termine_heute_sub")}
                        trend="neutral"
                    />
                )}
                {stats.einnahmen_monat != null && (
                    <StatCard
                        label={t("dashboard.kpi.umsatz_mtd")}
                        value={formatCurrency(stats.einnahmen_monat)}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={t("dashboard.kpi.umsatz_mtd_sub")}
                        trend="neutral"
                    />
                )}
                {stats.produkte_niedrig != null && (
                    <StatCard
                        label={t("dashboard.kpi.lager_niedrig")}
                        value={String(stats.produkte_niedrig)}
                        icon="Package"
                        accent="#FF9500"
                        sub={t("dashboard.kpi.lager_niedrig_sub")}
                        trend="neutral"
                    />
                )}
            </div>
            <div className="split dashboard-main-split" style={{ gridTemplateColumns: "1.25fr 1fr", flex: 1 }}>
                <div className="col dashboard-col-primary" style={{ gap: 14 }}>
                    <div className="card dashboard-card-fill">
                        <div className="card-head">
                            <div>
                                <div className="card-title">{t("dashboard.freigaben.title")}</div>
                                <div className="card-sub">{t("dashboard.freigaben.sub")}</div>
                            </div>
                            <button type="button" className="btn btn-subtle" style={{ paddingInline: 18 }} onClick={() => navigate("/audit")}>{t("dashboard.freigaben.cta")}</button>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: "8px 0" }}>
                            <EmptyState icon="✅" title={t("dashboard.freigaben.empty_title")} description={t("dashboard.freigaben.empty_desc")} />
                        </div>
                    </div>
                    <div className="card dashboard-card-fill">
                        <div className="card-head">
                            <div>
                                <div className="card-title">{t("dashboard.bestellungen.title")}</div>
                                <div className="card-sub">{t("dashboard.bestellungen.sub")}</div>
                            </div>
                            <div className="row" style={{ gap: 8 }}>
                                <button type="button" className="btn btn-subtle" onClick={() => navigate("/bestellungen")}>{t("dashboard.bestellungen.cta")}</button>
                                <button type="button" className="btn btn-subtle" onClick={() => navigate("/produkte")}>{t("dashboard.bestellungen.cta_produkte")}</button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: "8px 0" }}>
                            <EmptyState icon="📦" title={t("dashboard.bestellungen.empty_title")} description={t("dashboard.bestellungen.empty_desc")} />
                        </div>
                    </div>
                </div>
                <div className="col dashboard-col-secondary" style={{ gap: 14 }}>
                    <div className="card dashboard-card-fill">
                        <div className="card-head">
                            <div className="card-title">{t("dashboard.heute.title")} · {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</div>
                            <span className="pill blue">Live</span>
                        </div>
                        <div className="dashboard-card-list">
                            {heuteTermine.length === 0 ? (
                                <div style={{ padding: "20px 20px 28px" }}>
                                    <p style={{ color: "var(--fg-3)", margin: 0, fontSize: 14 }}>{t("dashboard.heute.empty")}</p>
                                    <button type="button" className="btn btn-accent" style={{ marginTop: 14 }} onClick={() => navigate("/termine")}>
                                        {t("dashboard.heute.cta_termine")}
                                    </button>
                                </div>
                            ) : (
                                heuteTermine.map((r) => {
                                    const name = patientNameById.get(r.patient_id) ?? "Patient";
                                    const tone = r.art === "NOTFALL" ? "yellow" : r.status === "BESTAETIGT" ? "blue" : "green";
                                    return (
                                        <div key={r.id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">{r.uhrzeit.slice(0, 5)}</div>
                                                <div className="schedule-day-time-meta">{r.art.replace(/_/g, " ")}</div>
                                            </div>
                                            <div className="row" style={{ gap: 12 }}>
                                                <div
                                                    className="schedule-severity-bar"
                                                    style={{
                                                        background: tone === "green" ? "#30D158" : tone === "yellow" ? "#FFCC00" : "#0A84FF",
                                                    }}
                                                    aria-hidden
                                                />
                                                <div>
                                                    <div className="schedule-day-name">{name}</div>
                                                    <div className="schedule-day-meta-line">{terminStatusLabel(r.status)}</div>
                                                </div>
                                            </div>
                                            <span className={`pill ${tone === "green" ? "green" : tone === "yellow" ? "yellow" : "blue"}`}>{terminStatusLabel(r.status)}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="card" style={{ background: "linear-gradient(135deg, #0E455C 0%, #0D7D66 100%)", color: "#fff" }}>
                        <div style={{ padding: 24 }}>
                            <div className="row" style={{ gap: 10 }}>
                                <SparkleIcon size={16} />
                                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", opacity: 0.9 }}>MEDOC INSIGHTS</span>
                            </div>
                            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600, lineHeight: 1.45, opacity: 0.95 }}>
                                {t("dashboard.insights.body")}
                            </div>
                            <div className="row" style={{ marginTop: 22, gap: 12 }}>
                                <button
                                    type="button"
                                    className="btn"
                                    style={{ background: "#fff", color: "#111318", padding: "10px 20px", fontSize: 15, fontWeight: 700 }}
                                    onClick={() => navigate("/patienten")}
                                >
                                    {t("dashboard.insights.cta_primary")}
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    style={{ background: "rgba(255,255,255,0.16)", color: "#EAF4F1", padding: "10px 20px", fontSize: 15, fontWeight: 700 }}
                                    onClick={() => toast(t("dashboard.insights.dismiss_toast"), "info")}
                                >
                                    {t("dashboard.insights.cta_later")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    accent: string;
    sub?: string;
    trend?: "positive" | "negative" | "neutral";
}

function StatCard({ label, value, icon, accent, sub, trend = "neutral" }: StatCardProps) {
    const Ic = NAV_ICONS[icon] ?? NAV_ICONS["/"];
    const subColor =
        trend === "positive" ? "#5FAF8F" : trend === "negative" ? "#E57C7C" : "var(--fg-3)";
    return (
        <div className="card kpi">
            <div className="kpi-label">
                <span style={{ width: 22, height: 22, borderRadius: 7, background: `${accent}20`, color: accent, display: "grid", placeItems: "center" }}>
                    <Ic size={13} />
                </span>
                {label}
            </div>
            <div className="kpi-val">{value}</div>
            {sub ? <div className="kpi-delta"><span style={{ color: subColor }}>{sub}</span></div> : null}
        </div>
    );
}
