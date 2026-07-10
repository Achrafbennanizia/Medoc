import { type CSSProperties, type Dispatch, type SetStateAction, useMemo } from "react";
import { addMonths, format, startOfWeek } from "date-fns";
import type { Termin } from "@/models/types";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import type { AerztSummary } from "@/systems/practice-host/controllers/personal.controller";
import type { PraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import {
    monthCalPatientLoadAccentHex,
    monthCalPatientLoadTier,
    type MonthCalendarPatientLoadPrefs,
} from "@/lib/praxis-praeferenzen-storage";
import {
    buildTerminMonthCalendarCells,
    terminCalendarColumnCount,
    terminCalendarWeekdayLabelKeys,
    type TerminDoctorTone,
} from "@/lib/termin-calendar-ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { DoctorLegend } from "@/views/components/termin-doctor-legend";

export type TerminMonthCalendarProps = {
    monthOffset: number;
    onMonthChange: Dispatch<SetStateAction<number>>;
    termine: Termin[];
    aerzte: AerztSummary[];
    arztToneMap: Map<string, TerminDoctorTone>;
    patientLoadSettings: MonthCalendarPatientLoadPrefs;
    praxisCfg: PraxisArbeitszeitenConfig;
    onPickDay: (iso: string) => void;
};

export function TerminMonthCalendar({
    monthOffset,
    onMonthChange,
    termine,
    aerzte,
    arztToneMap,
    patientLoadSettings,
    praxisCfg,
    onPickDay,
}: TerminMonthCalendarProps) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const weekdayKeys = useMemo(() => terminCalendarWeekdayLabelKeys(praxisCfg), [praxisCfg]);
    const columnCount = useMemo(() => terminCalendarColumnCount(praxisCfg), [praxisCfg]);
    const anchor = addMonths(new Date(), monthOffset);
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const gridStart = useMemo(() => startOfWeek(first, { weekStartsOn: 1 }), [y, m]);
    const monthCells = useMemo(
        () => buildTerminMonthCalendarCells(gridStart, praxisCfg),
        [gridStart, praxisCfg],
    );
    const gridStyle = useMemo(
        () => ({ "--termin-calendar-cols": columnCount } as CSSProperties),
        [columnCount],
    );
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const byDate = termine.reduce<Record<string, Termin[]>>((acc, t) => {
        (acc[t.datum] ||= []).push(t);
        return acc;
    }, {});
    return (
        <div className="card card-pad termin-month-view termin-month-view--workweek fade-up" style={gridStyle}>
            <div className="month-view-topbar">
                <div className="row month-view-period termin-nav-controls" dir="ltr" style={{ gap: 8, fontWeight: 600, alignItems: "center" }}>
                    <button type="button" className="icon-btn" aria-label={t("termin.calendar.month_prev")} onClick={() => onMonthChange((o) => o - 1)}><ChevronLeftIcon size={16} /></button>
                    <span className="month-view-period-label">{format(first, "MMMM yyyy", { locale: dateFnsLocale })}</span>
                    <button type="button" className="icon-btn" aria-label={t("termin.calendar.month_next")} onClick={() => onMonthChange((o) => o + 1)}><ChevronRightIcon size={16} /></button>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => onMonthChange(0)}>{t("common.today")}</button>
                <DoctorLegend aerzte={aerzte} arztToneMap={arztToneMap} />
            </div>
            <div className="cal termine-month-cal">
                {weekdayKeys.map((key) => <div className="cal-head" key={key}>{t(key)}</div>)}
                {monthCells.map((date, idx) => {
                    const inMonth = date.getMonth() === m;
                    const iso = format(date, "yyyy-MM-dd");
                    const events = [...(byDate[iso] ?? [])].sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit));
                    const isTodayCell = iso === todayIso;
                    const terminCount = events.length;
                    const loadTier = terminCount > 0 ? monthCalPatientLoadTier(terminCount, patientLoadSettings) : null;
                    const loadHex =
                        loadTier != null ? monthCalPatientLoadAccentHex(loadTier, patientLoadSettings) : null;
                    const loadLabel =
                        loadTier === "few" ? t("termin.calendar.load.few") : loadTier === "medium" ? t("termin.calendar.load.medium") : loadTier === "high" ? t("termin.calendar.load.high") : "";
                    const terminBadgeText = terminCount === 1 ? t("termin.calendar.planned_one") : tp("termin.calendar.planned_label", { count: terminCount });
                    return (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            className={`cal-cell ${inMonth ? "" : "dim"} ${isTodayCell ? "today" : ""}`}
                            onClick={() => onPickDay(iso)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onPickDay(iso);
                                }
                            }}
                        >
                            <div className="cal-num">{date.getDate()}</div>
                            {inMonth ? (
                                terminCount > 0 ? (
                                    <div
                                        className="cal-cell-termin-pill"
                                        data-load-tier={loadTier ?? undefined}
                                        style={
                                            loadHex
                                                ? ({ "--termin-pill-accent": loadHex } as CSSProperties)
                                                : undefined
                                        }
                                        aria-label={`${terminBadgeText}, ${t("termin.calendar.load_label")} ${loadLabel}`}
                                        title={`${terminBadgeText} · ${t("termin.calendar.load_label")} ${loadLabel}`}
                                    >
                                        <span className="cal-cell-termin-pill__full">{terminBadgeText}</span>
                                        <span className="cal-cell-termin-pill__count" aria-hidden="true">
                                            {terminCount}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="cal-cell-termin-pill cal-cell-termin-pill--empty" aria-label={t("termin.calendar.no_appointments_day")}>
                                        —
                                    </div>
                                )
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
