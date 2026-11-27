/** Day view: one time column beside the mini month and the day overview. */
import { type Dispatch, type MutableRefObject, type MouseEvent as ReactMouseEvent, type SetStateAction, useMemo, useRef } from "react";
import { addMonths, format } from "date-fns";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { parseAppointmentDurationMin } from "@/lib/appointment-domain";
import { type PracticeWorkHoursConfig } from "@/lib/practice-planning";
import { practiceTodayYmd } from "@/lib/practice-timezone";
import { calendarMonthOffsetFromToday, deriveDayTimelineBounds, appointmentKindLabelFromAppointment, appointmentCountsAsPlanned, APPOINTMENT_DEFAULT_DUR_MIN, appointmentTimelineHourLabels, timeToMinutes, type AppointmentDoctorTone } from "@/lib/appointment-calendar-ui";
import type { Absence, Appointment } from "@/models/types";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { DoctorFilterChips, DoctorLegend } from "@/views/components/appointment-doctor-legend";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";

/** Group has up to 4 doctors (config/editions.yaml limits.group.doctors). */
const DAY_DOCTOR_COLUMNS_MAX = 4;
import { type AppointmentDragState, useDayTimelineLayout, useAppointmentDayCompactChrome } from "./grid-layout";
import { AppointmentHourGutterSnap } from "./hour-gutter-snap";
import { AppointmentTimeColumnBody } from "./time-column-body";

export function AppointmentDaySplit({
    dayDate,
    onJumpToDay,
    appointments,
    patientNameById,
    physicianToneMap,
    physicians,
    practiceCfg,
    monthOffset,
    onMonthOffsetChange,
    daySnapLabel,
    onClearDaySnapLabel,
    dragState,
    onAppointmentDragStart,
    clickSuppressUntilRef,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    emptyDescription,
    emptyHasFilters,
    onEmptyCreate,
    onEmptyResetFilters,
    nowMin,
    absences,
    selectedDoctorIds = [],
    onToggleDoctor,
}: {
    /** Group: doctors picked in the filter; empty = all. */
    selectedDoctorIds?: readonly string[];
    /** Group: header chips toggle the doctor filter (replaces the static legend). */
    onToggleDoctor?: (physicianId: string) => void;
    dayDate: Date;
    onJumpToDay: (d: Date) => void;
    appointments: Appointment[];
    patientNameById: Map<string, string>;
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    physicians: PhysicianSummary[];
    practiceCfg: PracticeWorkHoursConfig;
    monthOffset: number;
    onMonthOffsetChange: Dispatch<SetStateAction<number>>;
    daySnapLabel: { iso: string; startMin: number } | null;
    onClearDaySnapLabel: () => void;
    dragState: AppointmentDragState | null;
    onAppointmentDragStart: (state: AppointmentDragState, el: HTMLButtonElement, singleDay: boolean, pointer: { clientX: number; clientY: number }) => void;
    clickSuppressUntilRef: MutableRefObject<number>;
    onOpenDrawer: (t: Appointment) => void;
    onContextMenu: (t: Appointment, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number, physicianId?: string) => void;
    emptyDescription: string;
    emptyHasFilters: boolean;
    onEmptyCreate: () => void;
    onEmptyResetFilters?: () => void;
    nowMin: () => number;
    absences: Absence[];
}) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const weekdayKeys = [
        "appointment.calendar.weekday.mon",
        "appointment.calendar.weekday.tue",
        "appointment.calendar.weekday.wed",
        "appointment.calendar.weekday.thu",
        "appointment.calendar.weekday.fri",
        "appointment.calendar.weekday.sat",
        "appointment.calendar.weekday.sun",
    ] as const;
    const iso = format(dayDate, "yyyy-MM-dd");
    const timelineBounds = useMemo(() => deriveDayTimelineBounds(practiceCfg, iso), [practiceCfg, iso]);
    const hourLabels = useMemo(() => appointmentTimelineHourLabels(timelineBounds), [timelineBounds]);
    const { hostRef: dayTimelineRef, layout: dayAxisLayout } = useDayTimelineLayout(timelineBounds);
    const physicianNameById = useMemo(() => new Map(physicians.map((a) => [a.id, a.name])), [physicians]);
    const planned = appointments.filter(appointmentCountsAsPlanned);
    const confirmed = appointments.filter((t) => t.status === "CONFIRMED").length;
    const slotMin = timelineBounds.endMin - timelineBounds.startMin;
    const bookedMin = planned.reduce(
        (sum, ap) => sum + Math.max(5, parseAppointmentDurationMin(ap.notes, APPOINTMENT_DEFAULT_DUR_MIN)),
        0,
    );
    const auslastung = slotMin > 0 ? Math.min(100, Math.round((bookedMin / slotMin) * 100)) : 0;
    const freiH = Math.max(0, Math.round(((slotMin - bookedMin) / 60) * 10) / 10);
    const nMin = nowMin();
    const sortedToday = useMemo(
        () => [...appointments].filter(appointmentCountsAsPlanned).sort((a, b) => a.time.localeCompare(b.time)),
        [appointments],
    );
    const nextAppt = sortedToday.find((t) => timeToMinutes(t.time) >= nMin);

    const miniAnchor = addMonths(new Date(), monthOffset);
    const y = miniAnchor.getFullYear();
    const m = miniAnchor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayIso = practiceTodayYmd();
    const selectedIso = iso;

    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : daySnapLabel != null ? daySnapLabel.startMin : null;
    const hourGutterPhase: "drag" | "placed" | null =
        dragState != null ? "drag" : daySnapLabel != null ? "placed" : null;

    // Group (editions-plan §6.4): one column per doctor shown, so two agendas sit side by side.
    const doctorColumns = useMemo(() => {
        if (!DOCTOR_CONTEXT.showDoctorUi) return [];
        const shown = selectedDoctorIds.length ? physicians.filter((p) => selectedDoctorIds.includes(p.id)) : physicians;
        return shown.length >= 2 ? shown.slice(0, DAY_DOCTOR_COLUMNS_MAX) : [];
    }, [physicians, selectedDoctorIds]);

    const splitRef = useRef<HTMLDivElement>(null);
    const compactChrome = useAppointmentDayCompactChrome(splitRef);

    const miniMonthCard = (
        <div className="card card-pad appointment-mini-month-card">
            <div className="row appointment-nav-controls" dir="ltr" style={{ justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_prev")} onClick={() => onMonthOffsetChange((o) => o - 1)}>
                    <ChevronLeftIcon size={16} />
                </button>
                <span className="appointment-mini-month-title">{format(first, "MMMM yyyy", { locale: dateFnsLocale })}</span>
                <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_next")} onClick={() => onMonthOffsetChange((o) => o + 1)}>
                    <ChevronRightIcon size={16} />
                </button>
            </div>
            <div className="appointment-mini-cal">
                {weekdayKeys.map((key, i) => (
                    <div key={`${key}-${i}`} className="appointment-mini-cal-head">{t(key)}</div>
                ))}
                {Array.from({ length: 42 }).map((_, idx) => {
                    const dayN = idx - startOffset + 1;
                    const inMonth = dayN > 0 && dayN <= daysInMonth;
                    const date = inMonth ? new Date(y, m, dayN) : undefined;
                    const cellIso = date ? format(date, "yyyy-MM-dd") : "";
                    const isToday = Boolean(inMonth && cellIso === todayIso);
                    const isSel = Boolean(inMonth && cellIso === selectedIso);
                    return (
                        <button
                            key={idx}
                            type="button"
                            disabled={!inMonth}
                            className={`appointment-mini-cal-cell ${!inMonth ? "dim" : ""} ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
                            onClick={() => {
                                if (!date) return;
                                onJumpToDay(date);
                                onMonthOffsetChange(calendarMonthOffsetFromToday(date));
                            }}
                        >
                            {inMonth ? dayN : ""}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const tagesuebersichtBlock = (
        <>
            <div className="appointment-side-h3">{t("appointment.calendar.day_overview")}</div>
            <div className="appointment-stat-big">{planned.length}</div>
            <div className="appointment-stat-big-label">{t("appointment.calendar.planned_count")}</div>
            <div className="appointment-stat-row appointment-stat-row--day">
                <span>
                    <span className="appointment-stat-line-label">{t("appointment.calendar.utilization")}</span>
                    <b className="appointment-stat-line-val">{auslastung}%</b>
                </span>
                <span>
                    <span className="appointment-stat-line-label">{t("appointment.calendar.checked_in")}</span>
                    <b className="appointment-stat-line-val">{appointments.filter((t) => t.status === "CONFIRMED").length}</b>
                </span>
                <span>
                    <span className="appointment-stat-line-label">{t("appointment.calendar.free")}</span>
                    <b className="appointment-stat-line-val">{freiH}h</b>
                </span>
            </div>
        </>
    );

    const naechsterAppointmentBlock = (
        <>
            <div className="appointment-side-h3">{t("appointment.calendar.next_title")}</div>
            {nextAppt ? (
                <>
                    <div className="appointment-next-time">{nextAppt.time.slice(0, 5)}</div>
                    <div className="appointment-next-name">{patientNameById.get(nextAppt.patient_id) ?? "Patient"}</div>
                    <div className="appointment-next-meta">
                        {appointmentKindLabelFromAppointment(nextAppt)} · {physicians.find((a) => a.id === nextAppt.physician_id)?.name ?? ""}
                    </div>
                </>
            ) : sortedToday.length > 0 ? (
                <p className="appointment-next-empty">{t("appointment.calendar.next_empty_later")}</p>
            ) : (
                <p className="appointment-next-empty">{t("appointment.calendar.next_empty_today")}</p>
            )}
        </>
    );

    return (
        <div ref={splitRef} className={`appointment-day-split fade-up${compactChrome ? " appointment-day-split--compact" : ""}`}>
            <div className="card card-pad appointment-day-main">
                <div className="appointment-day-split-head">
                    <div>
                        <div className="card-title">{format(dayDate, "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}</div>
                        <div className="card-sub">
                            {tp("appointment.calendar.day_subtitle", { planned: planned.length, confirmed: confirmed })}
                        </div>
                    </div>
                    {onToggleDoctor ? (
                        <DoctorFilterChips
                            physicians={physicians}
                            physicianToneMap={physicianToneMap}
                            selectedIds={selectedDoctorIds}
                            onToggle={onToggleDoctor}
                        />
                    ) : (
                        <DoctorLegend physicians={physicians} physicianToneMap={physicianToneMap} />
                    )}
                </div>
                {sortedToday.length === 0 ? (
                    <div className="appointment-day-empty">
                        <EmptyState
                            graphic={(
                                <span className="empty-state-icon-calendar" aria-hidden>
                                    <CalendarIcon size={34} />
                                </span>
                            )}
                            title={t("appointment.calendar.empty_day")}
                            description={emptyDescription}
                        />
                        <div className="schedule-day-empty-actions">
                            <Button type="button" onClick={onEmptyCreate}>{t("appointment.calendar.create")}</Button>
                            {emptyHasFilters && onEmptyResetFilters ? (
                                <Button type="button" variant="ghost" onClick={onEmptyResetFilters}>{t("common.reset_filters")}</Button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <>
                    {doctorColumns.length ? (
                        <div
                            className="appointment-day-doctor-heads"
                            style={{ ["--appointment-doctor-cols" as string]: String(doctorColumns.length) }}
                        >
                            <span aria-hidden />
                            {doctorColumns.map((doc) => (
                                <span key={doc.id} className="appointment-day-doctor-head">
                                    <span
                                        className={`appointment-legend-dot appointment-legend-dot--${physicianToneMap.get(doc.id) ?? "accent"}`}
                                        aria-hidden
                                    />
                                    {doc.name}
                                    <span className="appointment-day-doctor-count">
                                        {appointments.filter((a) => a.physician_id === doc.id && appointmentCountsAsPlanned(a)).length}
                                    </span>
                                </span>
                            ))}
                        </div>
                    ) : null}
                    <div className="appointment-day-timeline-host" ref={dayTimelineRef} data-appointment-day-canvas="1">
                        <div className="appointment-week-body-grid appointment-day-body-grid">
                            <div className="appointment-week-hours appointment-day-hours">
                                <div className="appointment-day-hours-stack" data-appointment-hour-gutter="1">
                                    {hourLabels.map((h) => (
                                        <div key={h} className="appointment-hour-label appointment-day-hour-label" style={{ height: dayAxisLayout.hourPx }}>
                                            {`${String(h).padStart(2, "0")}:00`}
                                        </div>
                                    ))}
                                    <AppointmentHourGutterSnap
                                        startMin={hourGutterSnapMin}
                                        pxPerMin={dayAxisLayout.pxPerMin}
                                        phase={hourGutterPhase}
                                        dayStartMin={timelineBounds.startMin}
                                    />
                                </div>
                            </div>
{doctorColumns.length ? (
                                <div
                                    className="appointment-day-doctor-cols"
                                    style={{ ["--appointment-doctor-cols" as string]: String(doctorColumns.length) }}
                                >
                                    {doctorColumns.map((doc, colIndex) => (
                                        <div key={doc.id} className="appointment-day-doctor-col">
            <AppointmentTimeColumnBody
                                        iso={iso}
                                        physicianId={doc.id}
                                showNowPill={colIndex === 0}
                                        appointments={appointments.filter((a) => a.physician_id === doc.id)}
                                        patientNameById={patientNameById}
                                        physicianToneMap={physicianToneMap}
                                        physicianNameById={physicianNameById}
                                        dragState={dragState}
                                        onAppointmentDragStart={onAppointmentDragStart}
                                        onBeginAppointmentDrag={onClearDaySnapLabel}
                                        onOpenDrawer={onOpenDrawer}
                                        onContextMenu={onContextMenu}
                                        onNewAt={onNewAt}
                                        nowMin={nowMin}
                                        singleDay
                                        clickSuppressUntilRef={clickSuppressUntilRef}
                                        axisLayout={dayAxisLayout}
                                        timelineBounds={timelineBounds}
                                        practiceCfg={practiceCfg}
                                        absences={absences}
                                    />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                                            <AppointmentTimeColumnBody
                                iso={iso}
                                appointments={appointments}
                                patientNameById={patientNameById}
                                physicianToneMap={physicianToneMap}
                                physicianNameById={physicianNameById}
                                dragState={dragState}
                                onAppointmentDragStart={onAppointmentDragStart}
                                onBeginAppointmentDrag={onClearDaySnapLabel}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay
                                clickSuppressUntilRef={clickSuppressUntilRef}
                                axisLayout={dayAxisLayout}
                                timelineBounds={timelineBounds}
                                practiceCfg={practiceCfg}
                                absences={absences}
                            />
                            )}
                        </div>
                    </div>
                    </>
                )}
            </div>
            <aside className="appointment-day-sidebar" aria-label={t("appointment.calendar.day_overview_aria")}>
                {miniMonthCard}
                {compactChrome ? (
                    <div className="card card-pad appointment-day-sidebar__summary appointment-next-card">
                        {tagesuebersichtBlock}
                        <div className="appointment-day-sidebar__next" style={{ marginTop: "var(--space-3)" }}>
                            {naechsterAppointmentBlock}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="card card-pad">{tagesuebersichtBlock}</div>
                        <div className="card card-pad appointment-next-card">{naechsterAppointmentBlock}</div>
                    </>
                )}
            </aside>
        </div>
    );
}
