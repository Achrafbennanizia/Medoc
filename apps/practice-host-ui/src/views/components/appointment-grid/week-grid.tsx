/** Week view: weekday header and one time column per working day. */
import { type CSSProperties, type MutableRefObject, type MouseEvent as ReactMouseEvent, useMemo } from "react";
import { addWeeks, format, startOfWeek } from "date-fns";
import { useDateFnsLocale } from "@/lib/i18n";
import { type PracticeWorkHoursConfig } from "@/lib/practice-planning";
import { practiceTodayYmd } from "@/lib/practice-timezone";
import { deriveWeekTimelineBounds, isAppointmentCalendarWorkingDay, appointmentCalendarColumnCount, appointmentCalendarWeekDays, appointmentTimelineHourLabels, type AppointmentDoctorTone } from "@/lib/appointment-calendar-ui";
import type { Absence, Appointment } from "@/models/types";
import { type AppointmentDragState, useDayTimelineLayout } from "./grid-layout";
import { AppointmentHourGutterSnap } from "./hour-gutter-snap";
import { AppointmentTimeColumnBody } from "./time-column-body";

export function AppointmentWeekGrid({
    appointments,
    weekOffset,
    patientNameById,
    physicianToneMap,
    physicianNameById,
    practiceCfg,
    dragState,
    onAppointmentDragStart,
    snapLabel,
    onClearSnapLabel,
    clickSuppressUntilRef,
    onHeaderDay,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    nowMin,
    absences,
}: {
    appointments: Appointment[];
    weekOffset: number;
    patientNameById: Map<string, string>;
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    physicianNameById?: Map<string, string>;
    practiceCfg: PracticeWorkHoursConfig;
    clickSuppressUntilRef: MutableRefObject<number>;
    dragState: AppointmentDragState | null;
    onAppointmentDragStart: (state: AppointmentDragState, el: HTMLButtonElement, singleDay: boolean, pointer: { clientX: number; clientY: number }) => void;
    snapLabel: { iso: string; startMin: number } | null;
    onClearSnapLabel: () => void;
    onHeaderDay: (iso: string) => void;
    onOpenDrawer: (t: Appointment) => void;
    onContextMenu: (t: Appointment, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    nowMin: () => number;
    absences: Absence[];
}) {
    const dateFnsLocale = useDateFnsLocale();
    const columnCount = useMemo(() => appointmentCalendarColumnCount(practiceCfg), [practiceCfg]);
    const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = useMemo(
        () => appointmentCalendarWeekDays(anchor, practiceCfg),
        [anchor, practiceCfg],
    );
    const weekIsoDates = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);
    const timelineBounds = useMemo(
        () => deriveWeekTimelineBounds(practiceCfg, weekIsoDates),
        [practiceCfg, weekIsoDates],
    );
    const hourLabels = useMemo(() => appointmentTimelineHourLabels(timelineBounds), [timelineBounds]);
    const gridStyle = useMemo(
        () =>
            ({
                "--appointment-calendar-cols": columnCount,
                "--appointment-slot-count": (timelineBounds.endMin - timelineBounds.startMin) / 60,
            }) as CSSProperties,
        [columnCount, timelineBounds.endMin, timelineBounds.startMin],
    );
    const byDate = useMemo(() => {
        const acc: Record<string, Appointment[]> = {};
        for (const appointment of appointments) {
            (acc[appointment.date] ??= []).push(appointment);
        }
        return acc;
    }, [appointments]);

    const { hostRef: weekTimelineRef, layout: weekAxisLayout } = useDayTimelineLayout(timelineBounds);
    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : snapLabel?.startMin ?? null;
    const hourGutterPhase: "drag" | "placed" | null = dragState != null ? "drag" : snapLabel != null ? "placed" : null;

    return (
        <div className="card card-pad appointment-week-card appointment-week-card--workweek fade-up" style={gridStyle}>
            <div className="appointment-week-head-grid">
                <div className="appointment-week-corner" aria-hidden />
                {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const isToday = iso === practiceTodayYmd();
                    const isInactiveDay = !isAppointmentCalendarWorkingDay(d, practiceCfg);
                    const dow = format(d, "EEEEE", { locale: dateFnsLocale }).toUpperCase();
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`appointment-week-dow ${isToday ? "today" : ""} ${isInactiveDay ? "weekend" : ""}`}
                            onClick={() => onHeaderDay(iso)}
                        >
                            <span className="appointment-week-dow-short">{dow}</span>
                            <span className="appointment-week-dow-num">{format(d, "d", { locale: dateFnsLocale })}</span>
                        </button>
                    );
                })}
            </div>
            <div className="appointment-week-body" ref={weekTimelineRef}>
                <div className="appointment-week-body-grid" data-appointment-week-canvas="1">
                    <div className="appointment-week-hours">
                        <div className="appointment-week-hours-stack" data-appointment-hour-gutter="1">
                            {hourLabels.map((h) => (
                                <div key={h} className="appointment-hour-label" style={{ height: weekAxisLayout.hourPx }}>
                                    {`${String(h).padStart(2, "0")}:00`}
                                </div>
                            ))}
                            <AppointmentHourGutterSnap
                                startMin={hourGutterSnapMin}
                                pxPerMin={weekAxisLayout.pxPerMin}
                                phase={hourGutterPhase}
                                dayStartMin={timelineBounds.startMin}
                            />
                        </div>
                    </div>
                    {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const columnAppointments = byDate[iso] ?? [];
                        return (
                            <AppointmentTimeColumnBody
                                key={iso}
                                iso={iso}
                                appointments={columnAppointments}
                                patientNameById={patientNameById}
                                physicianToneMap={physicianToneMap}
                                physicianNameById={physicianNameById}
                                dragState={dragState}
                                onAppointmentDragStart={onAppointmentDragStart}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay={false}
                                axisLayout={weekAxisLayout}
                                timelineBounds={timelineBounds}
                                practiceCfg={practiceCfg}
                                absences={absences}
                                onBeginAppointmentDrag={onClearSnapLabel}
                                clickSuppressUntilRef={clickSuppressUntilRef}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
