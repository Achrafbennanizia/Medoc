import { addWeeks, format, subWeeks } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import {
    workTimeGetTeamOverview,
    type WorkTimeTeamMemberRow,
    type WorkTimeTeamOverview,
} from "@/systems/practice-host/controllers/work-time.controller";
import { formatWorkMinutes } from "@/lib/work-time-ui";
import { weekStartMonday, ymd } from "@/lib/personal-arbeitsplan";
import { errorMessage } from "@/lib/utils";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";

function statusLabel(s: string, t: (key: string) => string): string {
    if (s === "RUNNING") return t("page.arbeitszeit.status.active");
    if (s === "PAUSED") return t("page.arbeitszeit.status.paused");
    if (s === "AUS") return t("page.arbeitszeit.status.off");
    return s;
}

export function ArbeitszeitTeamPage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const toast = useToastStore((s) => s.add);
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [overview, setOverview] = useState<WorkTimeTeamOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

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

    if (loading && !overview) return <PageLoading />;
    if (error && !overview) return <PageLoadError message={error} onRetry={() => void load()} />;

    const members = overview?.members ?? [];

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.arbeitszeit.team.title")}
                subtitle={t("page.arbeitszeit.team.subtitle")}
                actions={
                    <div className="row" style={{ gap: 8 }}>
                        <Link to="/verwaltung/team" className="btn btn-subtle">
                            {t("page.arbeitszeit.team.menu")}
                        </Link>
                        <Link to="/personal/arbeitszeit" className="btn btn-subtle">
                            {t("page.arbeitszeit.team.own_tracking")}
                        </Link>
                    </div>
                }
            />

            <Card>
                <CardHeader
                    title={tp("page.arbeitszeit.team.calendar_week", { start: weekLabel, end: weekEndLabel })}
                    action={
                        <div className="row" style={{ gap: 6 }}>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}>
                                ←
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}>
                                →
                            </Button>
                        </div>
                    }
                />
                <div className="card-pad" style={{ overflowX: "auto" }}>
                    <table className="tbl" style={{ width: "100%", minWidth: 640 }}>
                        <thead>
                            <tr>
                                <th>{t("page.arbeitszeit.team.col.staff")}</th>
                                <th>{t("page.arbeitszeit.team.col.status")}</th>
                                <th>{t("page.arbeitszeit.team.col.today")}</th>
                                <th>{t("page.arbeitszeit.team.col.week")}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ color: "var(--fg-3)" }}>
                                        {t("page.arbeitszeit.team.empty")}
                                    </td>
                                </tr>
                            ) : (
                                members.map((m) => (
                                    <TeamRow
                                        key={m.personalId}
                                        row={m}
                                        expanded={expanded === m.personalId}
                                        onToggle={() =>
                                            setExpanded((id) => (id === m.personalId ? null : m.personalId))
                                        }
                                        t={t}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function TeamRow({
    row,
    expanded,
    onToggle,
    t,
}: {
    row: WorkTimeTeamMemberRow;
    expanded: boolean;
    onToggle: () => void;
    t: (key: string) => string;
}) {
    const max = Math.max(row.weekMinutes, 1);
    const pct = Math.min(100, (row.weekMinutes / max) * 100);
    return (
        <>
            <tr>
                <td>{row.name}</td>
                <td>{statusLabel(row.status, t)}</td>
                <td>{formatWorkMinutes(row.todayMinutes)}</td>
                <td>{formatWorkMinutes(row.weekMinutes)}</td>
                <td>
                    <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
                        {expanded ? t("page.arbeitszeit.team.less") : t("page.arbeitszeit.team.details")}
                    </Button>
                </td>
            </tr>
            {expanded ? (
                <tr>
                    <td colSpan={5} style={{ paddingTop: 0 }}>
                        <div className="work-time-week-bar" style={{ maxWidth: 320 }}>
                            <div className="work-time-week-bar__track">
                                <div className="work-time-week-bar__ist" style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    </td>
                </tr>
            ) : null}
        </>
    );
}
