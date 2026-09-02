import {
    type CSSProperties,
    type Dispatch,
    type MutableRefObject,
    type MouseEvent as ReactMouseEvent,
    type SetStateAction,
    memo,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { addMonths, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { extractToothacheFdisFromChiefComplaint } from "@/lib/dental";
import { appointmentIsEmergencyMarked, parseAppointmentDurationMin } from "@/lib/appointment-domain";
import { minutesToTime } from "@/lib/appointment-availability";
import type { PracticeWorkHoursConfig } from "@/lib/practice-planning";
import {
    blockToneForAppointment,
    calendarMonthOffsetFromToday,
    deriveDayClosedSpans,
    deriveDayTimelineBounds,
    deriveWeekTimelineBounds,
    doctorStripeVar,
    isAppointmentCalendarWorkingDay,
    appointmentKindLabelFromAppointment,
    appointmentCalendarColumnCount,
    appointmentCalendarStatusPill,
    appointmentCalendarWeekDays,
    appointmentCountsAsPlanned,
    APPOINTMENT_DEFAULT_DUR_MIN,
    APPOINTMENT_HOUR_PX,
    APPOINTMENT_PX_PER_MIN,
    appointmentTimelineHourLabels,
    appointmentTimeToMinutes,
    type AppointmentDoctorTone,
    type AppointmentTimelineBounds,
} from "@/lib/appointment-calendar-ui";
import type { Appointment } from "@/models/types";
import { BoltIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { DoctorLegend } from "@/views/components/appointment-doctor-legend";
import { bindAppointmentDragBlock, createAppointmentDragGhost, paintAppointmentDragVisual } from "@/lib/appointment-drag-runtime";

const PX_PER_MIN = APPOINTMENT_PX_PER_MIN;
const HOUR_PX = APPOINTMENT_HOUR_PX;
const timeToMinutes = appointmentTimeToMinutes;

export type AppointmentDragState = {
    id: string;
    physicianId: string;
    date: string;
    durMin: number;
    originalDate: string;
    originalStartMin: number;
    currentDate: string;
    currentStartMin: number;
    dropAllowed: boolean;
};

function useDayTimelineLayout(bounds: AppointmentTimelineBounds) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState(() => ({ hourPx: HOUR_PX, pxPerMin: PX_PER_MIN }));
    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const apply = () => {
            const h = el.clientHeight;
            const slots = (bounds.endMin - bounds.startMin) / 60;
            if (h < 40) return;
            const hourPx = h / slots;
            setLayout({ hourPx, pxPerMin: hourPx / 60 });
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, [bounds.endMin, bounds.startMin]);
    return { hostRef, layout };
}

/** Day view: below this height compact sidebar (scroll + condensed cards). */
const APPOINTMENT_DAY_COMPACT_HEIGHT_PX = 680;

function useAppointmentDayCompactChrome(hostRef: React.RefObject<HTMLDivElement | null>) {
    const [compact, setCompact] = useState(false);
    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const apply = () => setCompact(el.clientHeight < APPOINTMENT_DAY_COMPACT_HEIGHT_PX);
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, [hostRef]);
    return compact;
}

function AppointmentHourGutterSnap(props: {
    startMin: number | null;
    pxPerMin: number;
    phase: "drag" | "placed" | null;
    dayStartMin: number;
}) {
    const { startMin, pxPerMin, phase, dayStartMin } = props;
    if (startMin == null || phase == null) return null;
    return (
        <div
            className={`appointment-hour-gutter-snap appointment-hour-gutter-snap--${phase}`}
            style={{ top: (startMin - dayStartMin) * pxPerMin }}
            aria-hidden
        >
            <span className="appointment-hour-gutter-snap__time">{minutesToTime(startMin)}</span>
        </div>
    );
}

const AppointmentApptBlockView = memo(function AppointmentApptBlockView({
    appointment,
    patientName,
    doctorTone,
    dayColumn,
    daySlotDurationMin,
    dragPreviewTime,
    dragging,
    dragInvalid,
    dragTargetDateHint,
    style,
    onClick,
    onMouseDown,
    onContextMenu,
}: {
    appointment: Appointment;
    patientName: string;
    doctorTone: AppointmentDoctorTone;
    doctorName?: string;
    compact?: boolean;
    dayColumn?: boolean;
    dragPreviewTime?: string;
    daySlotDurationMin?: number;
    dragging?: boolean;
    dragInvalid?: boolean;
    /** Day view: short date of target when another day is chosen via drag */
    dragTargetDateHint?: string;
    style?: CSSProperties;
    onClick: () => void;
    onMouseDown: (e: ReactMouseEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
}) {
    const tp = useTParams();
    const blockTone = blockToneForAppointment(appointment, doctorTone);
    const cancelled = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
    const durMin = daySlotDurationMin ?? APPOINTMENT_DEFAULT_DUR_MIN;
    const timeStr = (dragPreviewTime ?? appointment.time).slice(0, 5);
    const pill = appointmentCalendarStatusPill(appointment);
    const stripeColor = doctorStripeVar(doctorTone);
    const weekCompact = !dayColumn;
    const painTeeth = extractToothacheFdisFromChiefComplaint(appointment.chief_complaint);
    return (
        <button
            type="button"
            data-appointment-appt-id={appointment.id}
            className={`appointment-appt-block appointment-appt-block--calendar-row ${dayColumn ? "appointment-appt-block--day-tall" : "appointment-appt-block--week-compact"} appointment-appt-block--${blockTone}${cancelled ? " appointment-appt-block--cancelled" : ""}${dragging ? " appointment-appt-block--dragging" : ""}${dragging && dragInvalid ? " appointment-appt-block--drag-invalid" : ""}${weekCompact ? ` appointment-appt-status-surface--${pill.tone}` : ""}`}
            style={{
                ...style,
            }}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
        >
            <span className="appointment-appt-block-time-col">
                <span className={`appointment-appt-block-time${dragPreviewTime ? " appointment-appt-block-time--drag-live" : ""}`}>{timeStr}</span>
                <span className="appointment-appt-block-duration">{durMin} min</span>
            </span>
            <span className="appointment-appt-block-stripe" style={{ background: stripeColor }} aria-hidden />
            <span className="appointment-appt-block-body-col">
                <span className="appointment-appt-block-name-row">
                    {appointmentIsEmergencyMarked(appointment) ? (
                        <span className="appointment-appt-block-emergency-ic" aria-hidden>
                            <BoltIcon size={12} />
                        </span>
                    ) : null}
                    <span className="appointment-appt-block-name">{patientName}</span>
                </span>
                <span className="appointment-appt-block-sub">
                    <span className="appointment-appt-block-duration appointment-appt-block-duration--compact">{durMin} min</span>
                    <span className="appointment-appt-block-sub-sep" aria-hidden>
                        ·
                    </span>
                    <span className="appointment-appt-block-type">{appointmentKindLabelFromAppointment(appointment)}</span>
                </span>
                {painTeeth.length ? (
                    <span
                        className="appointment-appt-block-tooth"
                        title={tp("dental.toothache.title", { teeth: painTeeth.join(", ") })}
                    >
                        {painTeeth.length === 1
                            ? tp("dental.picker.one_tooth", { tooth: painTeeth[0] })
                            : tp("dental.picker.many_teeth", { teeth: painTeeth.join(", ") })}
                    </span>
                ) : null}
                {dragTargetDateHint ? (
                    <span className="appointment-appt-block-target-day">{dragTargetDateHint}</span>
                ) : null}
            </span>
            {weekCompact ? (
                <span className="sr-only">{pill.label}</span>
            ) : (
                <span className={`appointment-appt-status-pill appointment-appt-status-pill--${pill.tone}`}>{pill.label}</span>
            )}
        </button>
    );
});

function AppointmentTimeColumnBody({
    iso,
    appointments,
    patientNameById,
    physicianToneMap,
    physicianNameById,
    dragState,
    setDragState,
    onBeginAppointmentDrag,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    nowMin,
    singleDay,
    axisLayout,
    clickSuppressUntilRef,
    timelineBounds,
    practiceCfg,
}: {
    iso: string;
    appointments: Appointment[];
    patientNameById: Map<string, string>;
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    physicianNameById?: Map<string, string>;
    dragState: AppointmentDragState | null;
    setDragState: Dispatch<SetStateAction<AppointmentDragState | null>>;
    /** Day view: reset hour snap when a Appointment block is grabbed for dragging */
    onBeginAppointmentDrag?: () => void;
    onOpenDrawer: (t: Appointment) => void;
    onContextMenu: (t: Appointment, e: ReactMouseEvent) => void;
    onNewAt: (isoDay: string, startMin: number) => void;
    nowMin: () => number;
    singleDay: boolean;
    /** Week view: discard first click after drag-drop (see parent ref). */
    clickSuppressUntilRef?: MutableRefObject<number>;
    /** Day and week view: hour height from available grid (ResizeObserver) */
    axisLayout?: { hourPx: number; pxPerMin: number };
    timelineBounds: AppointmentTimelineBounds;
    practiceCfg: PracticeWorkHoursConfig;
}) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const dayStartMin = timelineBounds.startMin;
    const dayEndMin = timelineBounds.endMin;
    const hourPx = axisLayout?.hourPx ?? HOUR_PX;
    const pxPerMin = axisLayout?.pxPerMin ?? PX_PER_MIN;
    const axisHeightPx = ((dayEndMin - dayStartMin) / 60) * hourPx;
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const isTodayCol = iso === todayIso;
    const isInactiveDay = !isAppointmentCalendarWorkingDay(parseISO(iso), practiceCfg);
    const dayList = useMemo(() => [...appointments].sort((a, b) => a.time.localeCompare(b.time)), [appointments]);
    const closedSpans = useMemo(
        () => deriveDayClosedSpans(practiceCfg, iso, timelineBounds),
        [practiceCfg, iso, timelineBounds],
    );
    const nMin = nowMin();

    useLayoutEffect(() => {
        if (!singleDay || !dragState || dragState.currentDate !== iso) return;
        const el = document.querySelector<HTMLButtonElement>(`[data-appointment-appt-id="${dragState.id}"]`);
        if (!el) return;
        bindAppointmentDragBlock(el);
        const topPx = (dragState.currentStartMin - dayStartMin) * pxPerMin;
        el.style.setProperty("--appointment-drag-top", `${topPx}px`);
        paintAppointmentDragVisual(topPx, dragState.currentStartMin, !dragState.dropAllowed);
    }, [dragState, iso, dayStartMin, pxPerMin]);

    const onColDblClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const y = e.clientY - r.top;
        const raw = dayStartMin + y / pxPerMin;
        const snapped = Math.round(raw / 15) * 15;
        const lo = dayStartMin;
        const hi = dayEndMin - 15;
        const start = Math.max(lo, Math.min(snapped, hi));
        onNewAt(iso, start);
    };

    return (
        <div
            className={`appointment-day-col ${isTodayCol ? "appointment-day-col--today" : ""} ${isInactiveDay ? "appointment-day-col--weekend" : ""}`}
            data-appointment-day-col={iso}
            data-single-day={singleDay ? "1" : undefined}
            style={{
                minHeight: axisHeightPx,
                height: axisHeightPx,
                ["--appointment-slot-count" as string]: String((dayEndMin - dayStartMin) / 60),
            }}
            onDoubleClick={onColDblClick}
            role="presentation"
        >
            {closedSpans.map((span, i) => (
                <div
                    key={`closed-${i}`}
                    className="appointment-day-col__closed"
                    style={{
                        top: (span.fromMin - dayStartMin) * pxPerMin,
                        height: (span.toMin - span.fromMin) * pxPerMin,
                    }}
                    aria-hidden
                />
            ))}
            {Array.from({ length: (dayEndMin - dayStartMin) / 60 }).map((_, i) => (
                <div key={i} className="appointment-hour-line" style={{ top: i * hourPx }} />
            ))}
            {isTodayCol && nMin >= dayStartMin && nMin <= dayEndMin ? (
                <div className="appointment-now-line" style={{ top: (nMin - dayStartMin) * pxPerMin }}>
                    <span className="appointment-now-dot" />
                    {!singleDay ? null : (
                        <span className="appointment-now-pill">
                            {tp("appointment.calendar.now_pill", { time: minutesToTime(nMin) })}
                        </span>
                    )}
                </div>
            ) : null}
            {dayList.map((ap) => {
                if (!singleDay && dragState?.id === ap.id && ap.date !== iso) return null;
                const st = timeToMinutes(ap.time);
                const docTone = physicianToneMap.get(ap.physician_id) ?? "accent";
                const isDragThis = singleDay && dragState?.id === ap.id;
                const dispStart = isDragThis ? dragState!.currentStartMin : st;
                const layoutTop = (dispStart - dayStartMin) * pxPerMin;
                const dur = Math.max(5, parseAppointmentDurationMin(ap.notes, APPOINTMENT_DEFAULT_DUR_MIN));
                const minDayBlockPx = singleDay ? Math.max(56, pxPerMin * 24) : 0;
                const minWeekBlockPx = singleDay ? 0 : 48;
                const blockHeight = Math.max(dur * pxPerMin - 2, singleDay ? minDayBlockPx : minWeekBlockPx);
                const targetDayHint =
                    singleDay && isDragThis && dragState && dragState.currentDate !== iso
                        ? `→ ${format(parseISO(dragState.currentDate), "EEE d. MMM", { locale: dateFnsLocale })}`
                        : undefined;
                return (
                    <AppointmentApptBlockView
                        key={ap.id}
                        appointment={ap}
                        patientName={patientNameById.get(ap.patient_id) ?? t("appointment.calendar.patient_fallback")}
                        doctorName={physicianNameById?.get(ap.physician_id)}
                        doctorTone={docTone}
                        compact={!singleDay}
                        dayColumn={singleDay}
                        daySlotDurationMin={dur}
                        dragPreviewTime={isDragThis ? minutesToTime(dispStart) : undefined}
                        dragging={isDragThis}
                        dragInvalid={isDragThis && dragState ? !dragState.dropAllowed : false}
                        dragTargetDateHint={targetDayHint}
                        style={{
                            ...(isDragThis ? {} : { top: layoutTop }),
                            height: blockHeight,
                            insetInlineStart: 4,
                            insetInlineEnd: 4,
                        }}
                        onClick={() => {
                            if (clickSuppressUntilRef && Date.now() < clickSuppressUntilRef.current) return;
                            onOpenDrawer(ap);
                        }}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            onBeginAppointmentDrag?.();
                            const el = e.currentTarget as HTMLButtonElement;
                            const durMin = Math.max(5, parseAppointmentDurationMin(ap.notes, APPOINTMENT_DEFAULT_DUR_MIN));
                            if (singleDay) {
                                const topPx = (st - dayStartMin) * pxPerMin;
                                el.style.setProperty("--appointment-drag-top", `${topPx}px`);
                                bindAppointmentDragBlock(el);
                            } else {
                                createAppointmentDragGhost(el, ap.id);
                            }
                            setDragState({
                                id: ap.id,
                                physicianId: ap.physician_id,
                                date: iso,
                                durMin,
                                originalDate: ap.date,
                                originalStartMin: st,
                                currentDate: ap.date,
                                currentStartMin: st,
                                dropAllowed: true,
                            });
                        }}
                        onContextMenu={(e) => onContextMenu(ap, e)}
                    />
                );
            })}
        </div>
    );
}

export function AppointmentWeekGrid({
    appointments,
    weekOffset,
    patientNameById,
    physicianToneMap,
    practiceCfg,
    dragState,
    setDragState,
    snapLabel,
    onClearSnapLabel,
    clickSuppressUntilRef,
    onHeaderDay,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    nowMin,
}: {
    appointments: Appointment[];
    weekOffset: number;
    patientNameById: Map<string, string>;
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    practiceCfg: PracticeWorkHoursConfig;
    clickSuppressUntilRef: MutableRefObject<number>;
    dragState: AppointmentDragState | null;
    setDragState: Dispatch<SetStateAction<AppointmentDragState | null>>;
    snapLabel: { iso: string; startMin: number } | null;
    onClearSnapLabel: () => void;
    onHeaderDay: (iso: string) => void;
    onOpenDrawer: (t: Appointment) => void;
    onContextMenu: (t: Appointment, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    nowMin: () => number;
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
                    const isToday = iso === format(new Date(), "yyyy-MM-dd");
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
                                dragState={dragState}
                                setDragState={setDragState}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay={false}
                                axisLayout={weekAxisLayout}
                                timelineBounds={timelineBounds}
                                practiceCfg={practiceCfg}
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
    setDragState,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    emptyDescription,
    emptyHasFilters,
    onEmptyCreate,
    onEmptyResetFilters,
    nowMin,
}: {
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
    setDragState: Dispatch<SetStateAction<AppointmentDragState | null>>;
    onOpenDrawer: (t: Appointment) => void;
    onContextMenu: (t: Appointment, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    emptyDescription: string;
    emptyHasFilters: boolean;
    onEmptyCreate: () => void;
    onEmptyResetFilters?: () => void;
    nowMin: () => number;
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
    const bookedMin = planned.length * APPOINTMENT_DEFAULT_DUR_MIN;
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
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const selectedIso = iso;

    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : daySnapLabel != null ? daySnapLabel.startMin : null;
    const hourGutterPhase: "drag" | "placed" | null =
        dragState != null ? "drag" : daySnapLabel != null ? "placed" : null;

    const splitRef = useRef<HTMLDivElement>(null);
    const compactChrome = useAppointmentDayCompactChrome(splitRef);

    const miniMonthCard = (
        <div className="card card-pad appointment-mini-month-card">
            <div className="row appointment-nav-controls" dir="ltr" style={{ justifyContent: "space-between", marginBottom: 8 }}>
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
                    <DoctorLegend physicians={physicians} physicianToneMap={physicianToneMap} />
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
                            <AppointmentTimeColumnBody
                                iso={iso}
                                appointments={appointments}
                                patientNameById={patientNameById}
                                physicianToneMap={physicianToneMap}
                                physicianNameById={physicianNameById}
                                dragState={dragState}
                                setDragState={setDragState}
                                onBeginAppointmentDrag={onClearDaySnapLabel}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay
                                axisLayout={dayAxisLayout}
                                timelineBounds={timelineBounds}
                                practiceCfg={practiceCfg}
                            />
                        </div>
                    </div>
                )}
            </div>
            <aside className="appointment-day-sidebar" aria-label={t("appointment.calendar.day_overview_aria")}>
                {miniMonthCard}
                {compactChrome ? (
                    <div className="card card-pad appointment-day-sidebar__summary appointment-next-card">
                        {tagesuebersichtBlock}
                        <div className="appointment-day-sidebar__next" style={{ marginTop: 12 }}>
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
