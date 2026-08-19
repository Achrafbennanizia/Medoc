import { addWeeks, format, subWeeks } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import {
    workTimeGetTeamOverview,
    type WorkTimeTeamMemberRow,
    type WorkTimeTeamOverview,
} from "@/systems/practice-host/controllers/work-time.controller";
import { formatWorkMinutes } from "@/lib/work-time-ui";
import { weekStartMonday, ymd } from "@/lib/staff-work-plan";
import { errorMessage } from "@/lib/utils";
import { useCollatorLocale, useDateFnsLocale, useT, useTParams } from "@/lib/i18n";

function statusLabel(status: string, t: (key: string) => string): string {
    if (status === "RUNNING") return t("page.workTime.status.active");
    if (status === "PAUSED") return t("page.workTime.status.paused");
    if (status === "AUS") return t("page.workTime.status.off");
    return status;
}

function statusTone(status: string): string {
    if (status === "RUNNING") return "running";
    if (status === "PAUSED") return "paused";
    return "off";
}

export function WorkTimeTeamPage() {
    const t = useT();
    const tp = useTParams();
    const sortLocale = useCollatorLocale();
    const dateFnsLocale = useDateFnsLocale();
    const toast = useToastStore((s) => s.add);
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [overview, setOverview] = useState<WorkTimeTeamOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    const weekStartYmd = useMemo(() => ymd(weekStartMonday(weekAnchor)), [weekAnchor]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setOverview(await workTimeGetTeamOverview(weekStartYmd));
        } catch (e) {
            setError(errorMessage(e));
            toast(errorMessage(e), "error");
        } finally {
            setLoading(false);
        }
    }, [toast, weekStartYmd]);

    useEffect(() => {
        void load();
    }, [load]);

    const weekStart = weekStartMonday(weekAnchor);
    const weekLabel = format(weekStart, "d. MMM", { locale: dateFnsLocale });
    const weekEndLabel = format(addWeeks(weekStart, 1), "d. MMM yyyy", { locale: dateFnsLocale });

    const members = overview?.members ?? [];

    const filteredMembers = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = [...members].sort(
            (a, b) =>
                b.weekMinutes - a.weekMinutes ||
                a.name.localeCompare(b.name, sortLocale, { sensitivity: "base" }),
        );
        if (!q) return rows;
        return rows.filter((m) => m.name.toLowerCase().includes(q));
    }, [members, query, sortLocale]);

    const weekMaxMinutes = useMemo(
        () => Math.max(...members.map((m) => m.weekMinutes), 1),
        [members],
    );

    const kpis = useMemo(() => {
        const totalWeek = members.reduce((sum, m) => sum + m.weekMinutes, 0);
        const totalToday = members.reduce((sum, m) => sum + m.todayMinutes, 0);
        const activeNow = members.filter((m) => m.status === "RUNNING" || m.status === "PAUSED").length;
        return { totalWeek, totalToday, activeNow };
    }, [members]);

    if (loading && !overview) return <PageLoading />;
    if (error && !overview) return <PageLoadError message={error} onRetry={() => void load()} />;

    return (
        <div className="practice-workspace-page animate-fade-in work-time-team-page">
            <AdministrationPageHeader
                title={t("page.workTime.team.title")}
                subtitle={t("page.workTime.team.subtitle")}
                actions={
                    <div className="row work-time-team-head-actions">
                        <Link to="/staff/work-time" className="btn btn-subtle">
                            {t("page.workTime.team.own_tracking")}
                        </Link>
                    </div>
                }
            />

            <div className="work-time-team-kpis">
                <div className="work-time-team-kpi">
                    <span className="work-time-team-kpi__label">{t("page.workTime.team.kpi_week_total")}</span>
                    <span className="work-time-team-kpi__value">{formatWorkMinutes(kpis.totalWeek)}</span>
                </div>
                <div className="work-time-team-kpi work-time-team-kpi--today">
                    <span className="work-time-team-kpi__label">{t("page.workTime.team.kpi_today_total")}</span>
                    <span className="work-time-team-kpi__value">{formatWorkMinutes(kpis.totalToday)}</span>
                </div>
                <div className="work-time-team-kpi work-time-team-kpi--active">
                    <span className="work-time-team-kpi__label">{t("page.workTime.team.kpi_active_now")}</span>
                    <span className="work-time-team-kpi__value">{kpis.activeNow}</span>
                </div>
            </div>

            <Card className="work-time-team-card">
                <CardHeader
                    title={tp("page.workTime.team.calendar_week", { start: weekLabel, end: weekEndLabel })}
                    action={
                        <div className="row work-time-team-week-nav" dir="ltr">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}>
                                ←
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor(new Date())}>
                                {t("page.workTime.team.today_week")}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}>
                                →
                            </Button>
                            <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
                                {t("page.workTime.team.refresh")}
                            </Button>
                        </div>
                    }
                />
                <div className="work-time-team-toolbar card-pad">
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("page.workTime.team.search_placeholder")}
                        aria-label={t("page.workTime.team.search_placeholder")}
                    />
                    <span className="work-time-team-toolbar__meta">
                        {tp("page.workTime.team.staff_count", { count: filteredMembers.length })}
                    </span>
                </div>
                <div className="work-time-team-table-wrap card-pad">
                    <table className="work-time-team-table">
                        <thead>
                            <tr>
                                <th>{t("page.workTime.team.col.staff")}</th>
                                <th>{t("page.workTime.team.col.status")}</th>
                                <th className="work-time-team-table__num">{t("page.workTime.team.col.today")}</th>
                                <th>{t("page.workTime.team.col.week")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="work-time-team-table__empty">
                                        {query.trim() ? t("page.workTime.team.empty_search") : t("page.workTime.team.empty")}
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((m) => (
                                    <TeamMemberRow key={m.staffId} row={m} weekMaxMinutes={weekMaxMinutes} t={t} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function TeamMemberRow({
    row,
    weekMaxMinutes,
    t,
}: {
    row: WorkTimeTeamMemberRow;
    weekMaxMinutes: number;
    t: (key: string) => string;
}) {
    const pct = Math.min(100, (row.weekMinutes / weekMaxMinutes) * 100);
    const tone = statusTone(row.status);

    return (
        <tr className={tone === "running" ? "work-time-team-row--active" : undefined}>
            <td>
                <span className="work-time-team-name">{row.name}</span>
            </td>
            <td>
                <span className={`work-time-team-status work-time-team-status--${tone}`}>
                    {statusLabel(row.status, t)}
                </span>
            </td>
            <td className="work-time-team-table__num">{formatWorkMinutes(row.todayMinutes)}</td>
            <td>
                <div className="work-time-team-week-cell">
                    <span className="work-time-team-week-value">{formatWorkMinutes(row.weekMinutes)}</span>
                    <div className="work-time-team-week-bar" aria-hidden>
                        <div className="work-time-team-week-bar__fill" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            </td>
        </tr>
    );
}
