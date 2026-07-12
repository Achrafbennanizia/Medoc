import { addWeeks, format, parseISO, subWeeks } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { useToastStore } from "../components/ui/toast-store";
import {
    workTimeEnd,
    workTimeGetActiveSession,
    workTimeGetWeekOverview,
    workTimePause,
    workTimeResume,
    workTimeStart,
    type WorkTimeActiveSession,
    type WorkTimeWeekOverview,
} from "@/systems/practice-host/controllers/work-time.controller";
import { loadArbeitsplanStore, weekDaysMonFirst, weekStartMonday, ymd } from "@/lib/personal-arbeitsplan";
import { buildWeekBarDays, formatWorkMinutes, liveElapsedMinutes } from "@/lib/work-time-ui";
import { errorMessage } from "@/lib/utils";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";

const DAY_SHORT_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

export function ArbeitszeitTrackingPage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const personalId = useAuthStore((s) => s.session?.user_id ?? "");
    const toast = useToastStore((s) => s.add);
    const [active, setActive] = useState<WorkTimeActiveSession | null>(null);
    const [overview, setOverview] = useState<WorkTimeWeekOverview | null>(null);
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [busy, setBusy] = useState(false);
    const [tick, setTick] = useState(0);

    const dowShort = useMemo(
        () => DAY_SHORT_KEYS.map((k) => t(`page.arbeitszeit.day_short.${k}`)),
        [t],
    );

    const weekStart = useMemo(() => weekStartMonday(weekAnchor), [weekAnchor]);
    const weekStartYmd = useMemo(() => ymd(weekStart), [weekStart]);
    const weekDays = useMemo(() => weekDaysMonFirst(weekStart).map((d) => ymd(d)), [weekStart]);
    const weeklyRules = useMemo(() => loadArbeitsplanStore().weeklyRules, [tick]);

    const refresh = useCallback(async () => {
        try {
            const [act, ov] = await Promise.all([
                workTimeGetActiveSession(),
                workTimeGetWeekOverview(weekStartYmd),
            ]);
            setActive(act);
            setOverview(ov);
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }, [toast, weekStartYmd]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const id = window.setInterval(() => setTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, []);

    const session = active?.session ?? null;
    const liveMinutes = useMemo(() => {
        if (!session) return 0;
        return liveElapsedMinutes(session, active?.openPauseMinutes ?? 0);
    }, [session, active?.openPauseMinutes, tick]);

    const weekBars = useMemo(() => {
        if (!overview || !personalId) return [];
        return buildWeekBarDays(
            weekDays,
            dowShort,
            personalId,
            weeklyRules,
            overview.days,
            session,
            active?.openPauseMinutes ?? 0,
        );
    }, [overview, personalId, weekDays, weeklyRules, session, active?.openPauseMinutes, tick, dowShort]);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await fn();
            await refresh();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const weekLabel = format(weekStart, "d. MMM", { locale: dateFnsLocale });
    const weekEndLabel = format(addWeeks(weekStart, 1), "d. MMM yyyy", { locale: dateFnsLocale });

    return (
        <div className="praxis-workspace-page animate-fade-in work-time-page">
            <WorkspacePageHeader
                title={t("page.arbeitszeit.title")}
                subtitle={t("page.arbeitszeit.tracking.subtitle")}
            />

            <div className="work-time-page__grid">
            <Card className="work-time-today-card">
                <CardHeader title={t("page.arbeitszeit.today")} />
                <div className="card-pad work-time-today-body">
                    <p className="work-time-today-clock">{formatWorkMinutes(liveMinutes)}</p>
                    <p className="work-time-today-status">
                        {t("page.arbeitszeit.status.label")}{" "}
                        <strong>
                            {!session
                                ? t("page.arbeitszeit.status.none")
                                : session.status === "PAUSED"
                                  ? t("page.arbeitszeit.status.paused")
                                  : t("page.arbeitszeit.status.active")}
                        </strong>
                        {session?.status === "PAUSED" && session.pauseStartedAt ? (
                            <span className="work-time-today-since">
                                {tp("page.arbeitszeit.status.since", {
                                    time: format(parseISO(session.pauseStartedAt), "HH:mm"),
                                })}
                            </span>
                        ) : null}
                    </p>
                    <p className="work-time-today-week-total">
                        {tp("page.arbeitszeit.week_finished", {
                            minutes: formatWorkMinutes(overview?.totalMinutes ?? 0),
                        })}
                    </p>
                    <div className="row work-time-today-actions">
                        {!session ? (
                            <Button type="button" disabled={busy} onClick={() => void run(workTimeStart)}>
                                {t("page.arbeitszeit.btn.start")}
                            </Button>
                        ) : (
                            <Button type="button" disabled={busy} onClick={() => void run(workTimeEnd)}>
                                {t("page.arbeitszeit.btn.end")}
                            </Button>
                        )}
                        {session?.status === "RUNNING" ? (
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(workTimePause)}>
                                {t("page.arbeitszeit.btn.pause")}
                            </Button>
                        ) : null}
                        {session?.status === "PAUSED" ? (
                            <Button type="button" disabled={busy} onClick={() => void run(workTimeResume)}>
                                {t("page.arbeitszeit.btn.resume")}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </Card>

            <Card className="work-time-week-card">
                <CardHeader
                    title={t("page.arbeitszeit.week_overview")}
                    action={
                        <div className="row termin-nav-controls" dir="ltr" style={{ gap: 6 }}>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}>
                                ←
                            </Button>
                            <span style={{ fontSize: 12, color: "var(--fg-3)", minWidth: 140, textAlign: "center" }}>
                                {weekLabel} – {weekEndLabel}
                            </span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}>
                                →
                            </Button>
                        </div>
                    }
                />
                <div className="card-pad work-time-week-grid">
                    {weekBars.map((day) => {
                        const max = Math.max(day.sollMinutes, day.workedMinutes + day.openMinutes, 1);
                        const sollPct = (day.sollMinutes / max) * 100;
                        const workedPct = (day.workedMinutes / max) * 100;
                        const openPct = (day.openMinutes / max) * 100;
                        const pausePct = (day.pauseMinutes / max) * 100;
                        return (
                            <div key={day.date} className="work-time-week-col">
                                <div className="work-time-week-label">{day.label}</div>
                                <div
                                    className="work-time-week-bar"
                                    title={tp("page.arbeitszeit.week_bar_tooltip", {
                                        date: day.date,
                                        minutes: formatWorkMinutes(day.workedMinutes + day.openMinutes),
                                    })}
                                >
                                    <div className="work-time-week-bar__track">
                                        {day.sollMinutes > 0 ? (
                                            <div className="work-time-week-bar__soll" style={{ width: `${sollPct}%` }} />
                                        ) : null}
                                        {day.workedMinutes > 0 ? (
                                            <div className="work-time-week-bar__ist" style={{ width: `${workedPct}%` }} />
                                        ) : null}
                                        {day.openMinutes > 0 ? (
                                            <div className="work-time-week-bar__open" style={{ width: `${openPct}%` }} />
                                        ) : null}
                                        {day.pauseMinutes > 0 ? (
                                            <div className="work-time-week-bar__pause" style={{ width: `${pausePct}%` }} />
                                        ) : null}
                                    </div>
                                </div>
                                <div className="work-time-week-meta">
                                    {formatWorkMinutes(day.workedMinutes + day.openMinutes)}
                                    {day.sollMinutes > 0 ? ` / ${formatWorkMinutes(day.sollMinutes)}` : ""}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="work-time-week-legend card-pad">
                    <span className="work-time-week-legend__item">
                        <span className="work-time-week-legend__swatch work-time-week-legend__swatch--ist" aria-hidden />
                        {t("page.statistik.arbeitszeit.week_actual")}
                    </span>
                    <span className="work-time-week-legend__item">
                        <span className="work-time-week-legend__swatch work-time-week-legend__swatch--soll" aria-hidden />
                        {t("page.arbeitsplan.soll_table.col.work")}
                    </span>
                </div>
                <p className="card-pad work-time-week-footer">
                    {t("page.arbeitszeit.footer.soll_hint")}{" "}
                    <Link to="/personal/arbeitsplan">{t("page.arbeitszeit.footer.open_plan")}</Link>
                    {" · "}
                    <Link to="/einstellungen">{t("page.arbeitszeit.footer.settings")}</Link>
                </p>
            </Card>
            </div>
        </div>
    );
}
