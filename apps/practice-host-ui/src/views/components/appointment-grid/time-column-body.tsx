/** One day column: hour lines, closed / absence bands, now line and the appointment blocks. */
import { type MutableRefObject, type MouseEvent as ReactMouseEvent, useLayoutEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { parseAppointmentDurationMin } from "@/lib/appointment-domain";
import { absenceBandsOnDay, minutesToTime } from "@/lib/appointment-availability";
import { practiceSlotMinutes, type PracticeWorkHoursConfig } from "@/lib/practice-planning";
import { practiceTodayYmd } from "@/lib/practice-timezone";
import { snapAppointmentDragPosition } from "@/lib/appointment-drag-snap";
import { deriveDayClosedSpans, isAppointmentCalendarWorkingDay, APPOINTMENT_DEFAULT_DUR_MIN, APPOINTMENT_BLOCK_GAP_PX, assignAppointmentOverlapLanes, appointmentOverlapLaneInsets, timeToMinutes, type AppointmentDoctorTone, type AppointmentTimelineBounds } from "@/lib/appointment-calendar-ui";
import type { Absence, Appointment } from "@/models/types";
import { bindAppointmentDragBlock, paintAppointmentDragVisual } from "@/lib/appointment-drag-runtime";
import { PX_PER_MIN, HOUR_PX, AppointmentDragState } from "./grid-layout";
import { AppointmentApptBlockView } from "./appointment-block";

export function AppointmentTimeColumnBody({
    iso,
    appointments,
    patientNameById,
    physicianToneMap,
    physicianNameById,
    dragState,
    onAppointmentDragStart,
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
    absences,
}: {
    iso: string;
    appointments: Appointment[];
    patientNameById: Map<string, string>;
    physicianToneMap: Map<string, AppointmentDoctorTone>;
    physicianNameById?: Map<string, string>;
    dragState: AppointmentDragState | null;
    onAppointmentDragStart: (state: AppointmentDragState, el: HTMLButtonElement, singleDay: boolean, pointer: { clientX: number; clientY: number }) => void;
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
    absences: Absence[];
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
    const todayIso = practiceTodayYmd();
    const isTodayCol = iso === todayIso;
    const isInactiveDay = !isAppointmentCalendarWorkingDay(parseISO(iso), practiceCfg);
    const dayList = useMemo(() => [...appointments].sort((a, b) => a.time.localeCompare(b.time)), [appointments]);
    const overlapLanes = useMemo(() => {
        const spans = dayList.map((ap) => {
            const startMin = timeToMinutes(ap.time);
            const dur = Math.max(5, parseAppointmentDurationMin(ap.notes, APPOINTMENT_DEFAULT_DUR_MIN));
            return { id: ap.id, startMin, endMin: startMin + dur };
        });
        return assignAppointmentOverlapLanes(spans);
    }, [dayList]);
    /** Day view: track hover magnify so laid-out width reserves the right border. */
    const [dayHoverLayoutScale, setDayHoverLayoutScale] = useState(1);
    useLayoutEffect(() => {
        const read = () => {
            const raw = Number.parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue("--appointment-card-hover-scale").trim(),
            );
            const next = Number.isFinite(raw) && raw > 1 ? raw : 1;
            setDayHoverLayoutScale((prev) => (prev === next ? prev : next));
        };
        read();
        const mo = new MutationObserver(read);
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-appointment-card-hover", "style", "class"],
        });
        window.addEventListener("storage", read);
        return () => {
            mo.disconnect();
            window.removeEventListener("storage", read);
        };
    }, []);
    const closedSpans = useMemo(
        () => deriveDayClosedSpans(practiceCfg, iso, timelineBounds),
        [practiceCfg, iso, timelineBounds],
    );
    const absenceBands = useMemo(
        () => absenceBandsOnDay(absences, iso, timelineBounds),
        [absences, iso, timelineBounds],
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
    }, [dragState, iso, dayStartMin, pxPerMin, singleDay]);

    const onColDblClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const y = e.clientY - r.top;
        const raw = dayStartMin + y / pxPerMin;
        const durMin = Math.max(5, practiceSlotMinutes(practiceCfg));
        const snap = snapAppointmentDragPosition({
            practiceCfg,
            absences,
            physicianId: practiceCfg.defaultPhysicianId ?? "",
            isoDate: iso,
            rawStartMin: raw,
            durMin,
            timelineBounds,
        });
        if (!snap.dayAllowed || !snap.slotAllowed) return;
        onNewAt(iso, snap.startMin);
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
            {absenceBands.map((span, i) => (
                <div
                    key={`absence-${i}`}
                    className="appointment-day-col__absence"
                    style={{
                        top: (span.fromMin - dayStartMin) * pxPerMin,
                        height: (span.toMin - span.fromMin) * pxPerMin,
                    }}
                    title={t("appointments.scheduling.absence")}
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
                // Height tracks duration on the timeline; leave a small gap before the next block.
                const blockHeight = Math.max(dur * pxPerMin - APPOINTMENT_BLOCK_GAP_PX, 1);
                const lane = overlapLanes.get(ap.id) ?? { col: 0, colCount: 1 };
                const insets = appointmentOverlapLaneInsets(
                    lane,
                    undefined,
                    undefined,
                    singleDay ? dayHoverLayoutScale : 1,
                );
                const targetDayHint =
                    singleDay && isDragThis && dragState && dragState.currentDate !== iso
                        ? `→ ${format(parseISO(dragState.currentDate), "EEE d. MMM", { locale: dateFnsLocale })}`
                        : undefined;
                return (
                    <AppointmentApptBlockView
                        // Stable per appointment: a drop updates the block in place instead of remounting it.
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
                            insetInlineStart: insets.insetInlineStart,
                            width: insets.width,
                            insetInlineEnd: "auto",
                            zIndex: isDragThis ? undefined : 4 + lane.col,
                        }}
                        onClick={(e) => {
                            // Pointer opens the drawer after drag mouseup (delayed). Keyboard Enter/Space still works.
                            if (e.detail !== 0) return;
                            if (clickSuppressUntilRef && Date.now() < clickSuppressUntilRef.current) return;
                            onOpenDrawer(ap);
                        }}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            onBeginAppointmentDrag?.();
                            const el = e.currentTarget as HTMLButtonElement;
                            const durMin = Math.max(5, parseAppointmentDurationMin(ap.notes, APPOINTMENT_DEFAULT_DUR_MIN));
                            onAppointmentDragStart(
                                {
                                    id: ap.id,
                                    physicianId: ap.physician_id,
                                    date: iso,
                                    durMin,
                                    originalDate: ap.date,
                                    originalStartMin: st,
                                    currentDate: ap.date,
                                    currentStartMin: st,
                                    dropAllowed: true,
                                },
                                el,
                                singleDay,
                                { clientX: e.clientX, clientY: e.clientY },
                            );
                        }}
                        onContextMenu={(e) => onContextMenu(ap, e)}
                    />
                );
            })}
        </div>
    );
}
