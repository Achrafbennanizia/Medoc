import { type CSSProperties, type Dispatch, type SetStateAction, useMemo } from "react";
import { addMonths, format, startOfWeek } from "date-fns";
import type { Appointment } from "@/models/types";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import type { PracticeWorkHoursConfig } from "@/lib/practice-planning";
import {
    monthCalPatientLoadAccentHex,
    monthCalPatientLoadTier,
    type MonthCalendarPatientLoadPrefs,
} from "@/lib/practice-preferences-storage";
import {
    buildAppointmentMonthCalendarCells,
    appointmentCalendarColumnCount,
    appointmentCalendarWeekdayLabelKeys,
    type AppointmentDoctorTone,
} from "@/lib/appointment-calendar-ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { DoctorLegend } from "@/views/components/appointment-doctor-legend";

export type AppointmentMonthCalendarProps = {
    monthOffset: number;
    onMonthChange: Dispatch<SetStateAction<number>>;
    appointments: Appointment[];
    physicians: PhysicianSummary[];
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    patientLoadSettings: MonthCalendarPatientLoadPrefs;
    practiceCfg: PracticeWorkHoursConfig;
    onPickDay: (iso: string) => void;
};

export function AppointmentMonthCalendar({
    monthOffset,
    onMonthChange,
    appointments,
    physicians,
    physicianToneMap,
    patientLoadSettings,
    practiceCfg,
    onPickDay,
}: AppointmentMonthCalendarProps) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const weekdayKeys = useMemo(() => appointmentCalendarWeekdayLabelKeys(practiceCfg), [practiceCfg]);
    const columnCount = useMemo(() => appointmentCalendarColumnCount(practiceCfg), [practiceCfg]);
    const anchor = addMonths(new Date(), monthOffset);
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const gridStart = useMemo(() => startOfWeek(first, { weekStartsOn: 1 }), [y, m]);
    const monthCells = useMemo(
        () => buildAppointmentMonthCalendarCells(gridStart, practiceCfg),
        [gridStart, practiceCfg],
    );
    const gridStyle = useMemo(
        () => ({ "--appointment-calendar-cols": columnCount } as CSSProperties),
        [columnCount],
    );
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const byDate = appointments.reduce<Record<string, Appointment[]>>((acc, t) => {
        (acc[t.date] ||= []).push(t);
        return acc;
    }, {});
    return (
        <div className="card card-pad appointment-month-view appointment-month-view--workweek fade-up" style={gridStyle}>
            <div className="month-view-topbar">
                <div className="row month-view-period appointment-nav-controls" dir="ltr" style={{ gap: 8, fontWeight: 600, alignItems: "center" }}>
                    <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_prev")} onClick={() => onMonthChange((o) => o - 1)}><ChevronLeftIcon size={16} /></button>
                    <span className="month-view-period-label">{format(first, "MMMM yyyy", { locale: dateFnsLocale })}</span>
                    <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_next")} onClick={() => onMonthChange((o) => o + 1)}><ChevronRightIcon size={16} /></button>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => onMonthChange(0)}>{t("common.today")}</button>
                <DoctorLegend physicians={physicians} physicianToneMap={physicianToneMap} />
            </div>
            <div className="cal appointments-month-cal">
                {weekdayKeys.map((key) => <div className="cal-head" key={key}>{t(key)}</div>)}
                {monthCells.map((date, idx) => {
                    const inMonth = date.getMonth() === m;
                    const iso = format(date, "yyyy-MM-dd");
                    const events = [...(byDate[iso] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
                    const isTodayCell = iso === todayIso;
                    const appointmentCount = events.length;
                    const loadTier = appointmentCount > 0 ? monthCalPatientLoadTier(appointmentCount, patientLoadSettings) : null;
                    const loadHex =
                        loadTier != null ? monthCalPatientLoadAccentHex(loadTier, patientLoadSettings) : null;
                    const loadLabel =
                        loadTier === "few" ? t("appointment.calendar.load.few") : loadTier === "medium" ? t("appointment.calendar.load.medium") : loadTier === "high" ? t("appointment.calendar.load.high") : "";
                    const appointmentBadgeText = appointmentCount === 1 ? t("appointment.calendar.planned_one") : tp("appointment.calendar.planned_label", { count: appointmentCount });
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
                                appointmentCount > 0 ? (
                                    <div
                                        className="cal-cell-appointment-pill"
                                        data-load-tier={loadTier ?? undefined}
                                        style={
                                            loadHex
                                                ? ({ "--appointment-pill-accent": loadHex } as CSSProperties)
                                                : undefined
                                        }
                                        aria-label={`${appointmentBadgeText}, ${t("appointment.calendar.load_label")} ${loadLabel}`}
                                        title={`${appointmentBadgeText} · ${t("appointment.calendar.load_label")} ${loadLabel}`}
                                    >
                                        <span className="cal-cell-appointment-pill__full">{appointmentBadgeText}</span>
                                        <span className="cal-cell-appointment-pill__count" aria-hidden="true">
                                            {appointmentCount}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="cal-cell-appointment-pill cal-cell-appointment-pill--empty" aria-label={t("appointment.calendar.no_appointments_day")}>
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
