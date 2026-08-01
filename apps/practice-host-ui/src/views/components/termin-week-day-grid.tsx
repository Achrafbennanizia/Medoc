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
import type { AerztSummary } from "@/systems/practice-host/controllers/personal.controller";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { extractZahnschmerzFdisFromBeschwerden } from "@/lib/dental";
import { terminIstNotfallMarkiert, parseTerminDurationMin } from "@/lib/termin-domain";
import { minutesToUhrzeit } from "@/lib/termin-availability";
import type { PraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import {
    blockToneForTermin,
    calendarMonthOffsetFromToday,
    deriveDayClosedSpans,
    deriveDayTimelineBounds,
    deriveTerminTimelineBounds,
    deriveWeekTimelineBounds,
    doctorStripeVar,
    isTerminCalendarWorkingDay,
    terminArtLabelFromTermin,
    terminCalendarColumnCount,
    terminCalendarStatusPill,
    terminCalendarWeekDays,
    terminCountsAsPlanned,
    TERMIN_DEFAULT_DUR_MIN,
    TERMIN_HOUR_PX,
    TERMIN_PX_PER_MIN,
    terminTimelineHourLabels,
    terminUhrzeitToMinutes,
    type TerminDoctorTone,
    type TerminTimelineBounds,
} from "@/lib/termin-calendar-ui";
import type { Termin } from "@/models/types";
import { BoltIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { DoctorLegend } from "@/views/components/termin-doctor-legend";
import { bindTerminDragBlock, createTerminDragGhost, paintTerminDragVisual } from "@/lib/termin-drag-runtime";

const PX_PER_MIN = TERMIN_PX_PER_MIN;
const HOUR_PX = TERMIN_HOUR_PX;
const uhrzeitToMinutes = terminUhrzeitToMinutes;

export type TerminDragState = {
    id: string;
    arztId: string;
    datum: string;
    durMin: number;
    originalDatum: string;
    originalStartMin: number;
    currentDatum: string;
    currentStartMin: number;
    dropAllowed: boolean;
};

function useDayTimelineLayout(bounds: TerminTimelineBounds) {
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
const TERMIN_DAY_COMPACT_HEIGHT_PX = 680;

function useTerminDayCompactChrome(hostRef: React.RefObject<HTMLDivElement | null>) {
    const [compact, setCompact] = useState(false);
    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const apply = () => setCompact(el.clientHeight < TERMIN_DAY_COMPACT_HEIGHT_PX);
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, [hostRef]);
    return compact;
}

function TerminHourGutterSnap(props: {
    startMin: number | null;
    pxPerMin: number;
    phase: "drag" | "placed" | null;
    dayStartMin: number;
}) {
    const { startMin, pxPerMin, phase, dayStartMin } = props;
    if (startMin == null || phase == null) return null;
    return (
        <div
            className={`termin-hour-gutter-snap termin-hour-gutter-snap--${phase}`}
            style={{ top: (startMin - dayStartMin) * pxPerMin }}
            aria-hidden
        >
            <span className="termin-hour-gutter-snap__time">{minutesToUhrzeit(startMin)}</span>
        </div>
    );
}

const TerminApptBlockView = memo(function TerminApptBlockView({
    termin,
    patientName,
    doctorTone,
    dayColumn,
    daySlotDurationMin,
    dragPreviewUhrzeit,
    dragging,
    dragInvalid,
    dragTargetDatumHint,
    style,
    onClick,
    onMouseDown,
    onContextMenu,
}: {
    termin: Termin;
    patientName: string;
    doctorTone: TerminDoctorTone;
    doctorName?: string;
    compact?: boolean;
    dayColumn?: boolean;
    dragPreviewUhrzeit?: string;
    daySlotDurationMin?: number;
    dragging?: boolean;
    dragInvalid?: boolean;
    /** Day view: short date of target when another day is chosen via drag */
    dragTargetDatumHint?: string;
    style?: CSSProperties;
    onClick: () => void;
    onMouseDown: (e: ReactMouseEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
}) {
    const tp = useTParams();
    const blockTone = blockToneForTermin(termin, doctorTone);
    const cancelled = termin.status === "ABGESAGT" || termin.status === "NICHT_ERSCHIENEN";
    const durMin = daySlotDurationMin ?? TERMIN_DEFAULT_DUR_MIN;
    const timeStr = (dragPreviewUhrzeit ?? termin.uhrzeit).slice(0, 5);
    const pill = terminCalendarStatusPill(termin);
    const stripeColor = doctorStripeVar(doctorTone);
    const weekCompact = !dayColumn;
    const schmerzZaehne = extractZahnschmerzFdisFromBeschwerden(termin.beschwerden);
    return (
        <button
            type="button"
            data-termin-appt-id={termin.id}
            className={`termin-appt-block termin-appt-block--calendar-row ${dayColumn ? "termin-appt-block--day-tall" : "termin-appt-block--week-compact"} termin-appt-block--${blockTone}${cancelled ? " termin-appt-block--cancelled" : ""}${dragging ? " termin-appt-block--dragging" : ""}${dragging && dragInvalid ? " termin-appt-block--drag-invalid" : ""}${weekCompact ? ` termin-appt-status-surface--${pill.tone}` : ""}`}
            style={{
                ...style,
            }}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
        >
            <span className="termin-appt-block-time-col">
                <span className={`termin-appt-block-time${dragPreviewUhrzeit ? " termin-appt-block-time--drag-live" : ""}`}>{timeStr}</span>
                <span className="termin-appt-block-duration">{durMin} min</span>
            </span>
            <span className="termin-appt-block-stripe" style={{ background: stripeColor }} aria-hidden />
            <span className="termin-appt-block-body-col">
                <span className="termin-appt-block-name-row">
                    {terminIstNotfallMarkiert(termin) ? (
                        <span className="termin-appt-block-notfall-ic" aria-hidden>
                            <BoltIcon size={12} />
                        </span>
                    ) : null}
                    <span className="termin-appt-block-name">{patientName}</span>
                </span>
                <span className="termin-appt-block-sub">
                    <span className="termin-appt-block-duration termin-appt-block-duration--compact">{durMin} min</span>
                    <span className="termin-appt-block-sub-sep" aria-hidden>
                        ·
                    </span>
                    <span className="termin-appt-block-type">{terminArtLabelFromTermin(termin)}</span>
                </span>
                {schmerzZaehne.length ? (
                    <span
                        className="termin-appt-block-zahn"
                        title={tp("dental.toothache.title", { teeth: schmerzZaehne.join(", ") })}
                    >
                        {schmerzZaehne.length === 1
                            ? tp("dental.picker.one_tooth", { tooth: schmerzZaehne[0] })
                            : tp("dental.picker.many_teeth", { teeth: schmerzZaehne.join(", ") })}
                    </span>
                ) : null}
                {dragTargetDatumHint ? (
                    <span className="termin-appt-block-target-day">{dragTargetDatumHint}</span>
                ) : null}
            </span>
            {weekCompact ? (
                <span className="sr-only">{pill.label}</span>
            ) : (
                <span className={`termin-appt-status-pill termin-appt-status-pill--${pill.tone}`}>{pill.label}</span>
            )}
        </button>
    );
});

function TerminTimeColumnBody({
    iso,
    termine,
    patientNameById,
    arztToneMap,
    arztNameById,
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
    praxisCfg,
}: {
    iso: string;
    termine: Termin[];
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, TerminDoctorTone>;
    arztNameById?: Map<string, string>;
    dragState: TerminDragState | null;
    setDragState: Dispatch<SetStateAction<TerminDragState | null>>;
    /** Day view: reset hour snap when a Termin block is grabbed for dragging */
    onBeginAppointmentDrag?: () => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (isoDay: string, startMin: number) => void;
    nowMin: () => number;
    singleDay: boolean;
    /** Week view: discard first click after drag-drop (see parent ref). */
    clickSuppressUntilRef?: MutableRefObject<number>;
    /** Day and week view: hour height from available grid (ResizeObserver) */
    axisLayout?: { hourPx: number; pxPerMin: number };
    timelineBounds: TerminTimelineBounds;
    praxisCfg: PraxisArbeitszeitenConfig;
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
    const isInactiveDay = !isTerminCalendarWorkingDay(parseISO(iso), praxisCfg);
    const dayList = useMemo(() => [...termine].sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit)), [termine]);
    const closedSpans = useMemo(
        () => deriveDayClosedSpans(praxisCfg, iso, timelineBounds),
        [praxisCfg, iso, timelineBounds],
    );
    const nMin = nowMin();

    useLayoutEffect(() => {
        if (!singleDay || !dragState || dragState.currentDatum !== iso) return;
        const el = document.querySelector<HTMLButtonElement>(`[data-termin-appt-id="${dragState.id}"]`);
        if (!el) return;
        bindTerminDragBlock(el);
        const topPx = (dragState.currentStartMin - dayStartMin) * pxPerMin;
        el.style.setProperty("--termin-drag-top", `${topPx}px`);
        paintTerminDragVisual(topPx, dragState.currentStartMin, !dragState.dropAllowed);
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
            className={`termin-day-col ${isTodayCol ? "termin-day-col--today" : ""} ${isInactiveDay ? "termin-day-col--weekend" : ""}`}
            data-termin-day-col={iso}
            data-single-day={singleDay ? "1" : undefined}
            style={{
                minHeight: axisHeightPx,
                height: axisHeightPx,
                ["--termin-slot-count" as string]: String((dayEndMin - dayStartMin) / 60),
            }}
            onDoubleClick={onColDblClick}
            role="presentation"
        >
            {closedSpans.map((span, i) => (
                <div
                    key={`closed-${i}`}
                    className="termin-day-col__closed"
                    style={{
                        top: (span.fromMin - dayStartMin) * pxPerMin,
                        height: (span.toMin - span.fromMin) * pxPerMin,
                    }}
                    aria-hidden
                />
            ))}
            {Array.from({ length: (dayEndMin - dayStartMin) / 60 }).map((_, i) => (
                <div key={i} className="termin-hour-line" style={{ top: i * hourPx }} />
            ))}
            {isTodayCol && nMin >= dayStartMin && nMin <= dayEndMin ? (
                <div className="termin-now-line" style={{ top: (nMin - dayStartMin) * pxPerMin }}>
                    <span className="termin-now-dot" />
                    {!singleDay ? null : (
                        <span className="termin-now-pill">
                            {tp("termin.calendar.now_pill", { time: minutesToUhrzeit(nMin) })}
                        </span>
                    )}
                </div>
            ) : null}
            {dayList.map((ap) => {
                if (!singleDay && dragState?.id === ap.id && ap.datum !== iso) return null;
                const st = uhrzeitToMinutes(ap.uhrzeit);
                const docTone = arztToneMap.get(ap.arzt_id) ?? "accent";
                const isDragThis = singleDay && dragState?.id === ap.id;
                const dispStart = isDragThis ? dragState!.currentStartMin : st;
                const layoutTop = (dispStart - dayStartMin) * pxPerMin;
                const dur = Math.max(5, parseTerminDurationMin(ap.notizen, TERMIN_DEFAULT_DUR_MIN));
                const minDayBlockPx = singleDay ? Math.max(56, pxPerMin * 24) : 0;
                const minWeekBlockPx = singleDay ? 0 : 48;
                const blockHeight = Math.max(dur * pxPerMin - 2, singleDay ? minDayBlockPx : minWeekBlockPx);
                const targetDayHint =
                    singleDay && isDragThis && dragState && dragState.currentDatum !== iso
                        ? `→ ${format(parseISO(dragState.currentDatum), "EEE d. MMM", { locale: dateFnsLocale })}`
                        : undefined;
                return (
                    <TerminApptBlockView
                        key={ap.id}
                        termin={ap}
                        patientName={patientNameById.get(ap.patient_id) ?? t("termin.calendar.patient_fallback")}
                        doctorName={arztNameById?.get(ap.arzt_id)}
                        doctorTone={docTone}
                        compact={!singleDay}
                        dayColumn={singleDay}
                        daySlotDurationMin={dur}
                        dragPreviewUhrzeit={isDragThis ? minutesToUhrzeit(dispStart) : undefined}
                        dragging={isDragThis}
                        dragInvalid={isDragThis && dragState ? !dragState.dropAllowed : false}
                        dragTargetDatumHint={targetDayHint}
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
                            const durMin = Math.max(5, parseTerminDurationMin(ap.notizen, TERMIN_DEFAULT_DUR_MIN));
                            if (singleDay) {
                                const topPx = (st - dayStartMin) * pxPerMin;
                                el.style.setProperty("--termin-drag-top", `${topPx}px`);
                                bindTerminDragBlock(el);
                            } else {
                                createTerminDragGhost(el, ap.id);
                            }
                            setDragState({
                                id: ap.id,
                                arztId: ap.arzt_id,
                                datum: iso,
                                durMin,
                                originalDatum: ap.datum,
                                originalStartMin: st,
                                currentDatum: ap.datum,
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

export function TerminWeekGrid({
    termine,
    weekOffset,
    patientNameById,
    arztToneMap,
    praxisCfg,
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
    termine: Termin[];
    weekOffset: number;
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, TerminDoctorTone>;
    praxisCfg: PraxisArbeitszeitenConfig;
    clickSuppressUntilRef: MutableRefObject<number>;
    dragState: TerminDragState | null;
    setDragState: Dispatch<SetStateAction<TerminDragState | null>>;
    snapLabel: { iso: string; startMin: number } | null;
    onClearSnapLabel: () => void;
    onHeaderDay: (iso: string) => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    nowMin: () => number;
}) {
    const dateFnsLocale = useDateFnsLocale();
    const columnCount = useMemo(() => terminCalendarColumnCount(praxisCfg), [praxisCfg]);
    const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = useMemo(
        () => terminCalendarWeekDays(anchor, praxisCfg),
        [anchor, praxisCfg],
    );
    const weekIsoDates = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);
    const timelineBounds = useMemo(
        () => deriveWeekTimelineBounds(praxisCfg, weekIsoDates),
        [praxisCfg, weekIsoDates],
    );
    const hourLabels = useMemo(() => terminTimelineHourLabels(timelineBounds), [timelineBounds]);
    const gridStyle = useMemo(
        () =>
            ({
                "--termin-calendar-cols": columnCount,
                "--termin-slot-count": (timelineBounds.endMin - timelineBounds.startMin) / 60,
            }) as CSSProperties,
        [columnCount, timelineBounds.endMin, timelineBounds.startMin],
    );
    const byDate = useMemo(() => {
        const acc: Record<string, Termin[]> = {};
        for (const termin of termine) {
            (acc[termin.datum] ??= []).push(termin);
        }
        return acc;
    }, [termine]);

    const { hostRef: weekTimelineRef, layout: weekAxisLayout } = useDayTimelineLayout(timelineBounds);
    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : snapLabel?.startMin ?? null;
    const hourGutterPhase: "drag" | "placed" | null = dragState != null ? "drag" : snapLabel != null ? "placed" : null;

    return (
        <div className="card card-pad termin-week-card termin-week-card--workweek fade-up" style={gridStyle}>
            <div className="termin-week-head-grid">
                <div className="termin-week-corner" aria-hidden />
                {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const isToday = iso === format(new Date(), "yyyy-MM-dd");
                    const isInactiveDay = !isTerminCalendarWorkingDay(d, praxisCfg);
                    const dow = format(d, "EEEEE", { locale: dateFnsLocale }).toUpperCase();
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`termin-week-dow ${isToday ? "today" : ""} ${isInactiveDay ? "weekend" : ""}`}
                            onClick={() => onHeaderDay(iso)}
                        >
                            <span className="termin-week-dow-short">{dow}</span>
                            <span className="termin-week-dow-num">{format(d, "d", { locale: dateFnsLocale })}</span>
                        </button>
                    );
                })}
            </div>
            <div className="termin-week-body" ref={weekTimelineRef}>
                <div className="termin-week-body-grid" data-termin-week-canvas="1">
                    <div className="termin-week-hours">
                        <div className="termin-week-hours-stack" data-termin-hour-gutter="1">
                            {hourLabels.map((h) => (
                                <div key={h} className="termin-hour-label" style={{ height: weekAxisLayout.hourPx }}>
                                    {`${String(h).padStart(2, "0")}:00`}
                                </div>
                            ))}
                            <TerminHourGutterSnap
                                startMin={hourGutterSnapMin}
                                pxPerMin={weekAxisLayout.pxPerMin}
                                phase={hourGutterPhase}
                                dayStartMin={timelineBounds.startMin}
                            />
                        </div>
                    </div>
                    {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const columnTermine = byDate[iso] ?? [];
                        return (
                            <TerminTimeColumnBody
                                key={iso}
                                iso={iso}
                                termine={columnTermine}
                                patientNameById={patientNameById}
                                arztToneMap={arztToneMap}
                                dragState={dragState}
                                setDragState={setDragState}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay={false}
                                axisLayout={weekAxisLayout}
                                timelineBounds={timelineBounds}
                                praxisCfg={praxisCfg}
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

export function TerminDaySplit({
    dayDate,
    onJumpToDay,
    termine,
    patientNameById,
    arztToneMap,
    aerzte,
    praxisCfg,
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
    termine: Termin[];
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, TerminDoctorTone>;
    aerzte: AerztSummary[];
    praxisCfg: PraxisArbeitszeitenConfig;
    monthOffset: number;
    onMonthOffsetChange: Dispatch<SetStateAction<number>>;
    daySnapLabel: { iso: string; startMin: number } | null;
    onClearDaySnapLabel: () => void;
    dragState: TerminDragState | null;
    setDragState: Dispatch<SetStateAction<TerminDragState | null>>;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
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
        "termin.calendar.weekday.mon",
        "termin.calendar.weekday.tue",
        "termin.calendar.weekday.wed",
        "termin.calendar.weekday.thu",
        "termin.calendar.weekday.fri",
        "termin.calendar.weekday.sat",
        "termin.calendar.weekday.sun",
    ] as const;
    const iso = format(dayDate, "yyyy-MM-dd");
    const timelineBounds = useMemo(() => deriveDayTimelineBounds(praxisCfg, iso), [praxisCfg, iso]);
    const hourLabels = useMemo(() => terminTimelineHourLabels(timelineBounds), [timelineBounds]);
    const { hostRef: dayTimelineRef, layout: dayAxisLayout } = useDayTimelineLayout(timelineBounds);
    const arztNameById = useMemo(() => new Map(aerzte.map((a) => [a.id, a.name])), [aerzte]);
    const planned = termine.filter(terminCountsAsPlanned);
    const bestaetigt = termine.filter((t) => t.status === "BESTAETIGT").length;
    const slotMin = timelineBounds.endMin - timelineBounds.startMin;
    const bookedMin = planned.length * TERMIN_DEFAULT_DUR_MIN;
    const auslastung = slotMin > 0 ? Math.min(100, Math.round((bookedMin / slotMin) * 100)) : 0;
    const freiH = Math.max(0, Math.round(((slotMin - bookedMin) / 60) * 10) / 10);
    const nMin = nowMin();
    const sortedToday = useMemo(
        () => [...termine].filter(terminCountsAsPlanned).sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit)),
        [termine],
    );
    const nextAppt = sortedToday.find((t) => uhrzeitToMinutes(t.uhrzeit) >= nMin);

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
    const compactChrome = useTerminDayCompactChrome(splitRef);

    const miniMonthCard = (
        <div className="card card-pad termin-mini-month-card">
            <div className="row termin-nav-controls" dir="ltr" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <button type="button" className="icon-btn" aria-label={t("termin.calendar.month_prev")} onClick={() => onMonthOffsetChange((o) => o - 1)}>
                    <ChevronLeftIcon size={16} />
                </button>
                <span className="termin-mini-month-title">{format(first, "MMMM yyyy", { locale: dateFnsLocale })}</span>
                <button type="button" className="icon-btn" aria-label={t("termin.calendar.month_next")} onClick={() => onMonthOffsetChange((o) => o + 1)}>
                    <ChevronRightIcon size={16} />
                </button>
            </div>
            <div className="termin-mini-cal">
                {weekdayKeys.map((key, i) => (
                    <div key={`${key}-${i}`} className="termin-mini-cal-head">{t(key)}</div>
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
                            className={`termin-mini-cal-cell ${!inMonth ? "dim" : ""} ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
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
            <div className="termin-side-h3">{t("termin.calendar.day_overview")}</div>
            <div className="termin-stat-big">{planned.length}</div>
            <div className="termin-stat-big-label">{t("termin.calendar.planned_count")}</div>
            <div className="termin-stat-row termin-stat-row--day">
                <span>
                    <span className="termin-stat-line-label">{t("termin.calendar.utilization")}</span>
                    <b className="termin-stat-line-val">{auslastung}%</b>
                </span>
                <span>
                    <span className="termin-stat-line-label">{t("termin.calendar.checked_in")}</span>
                    <b className="termin-stat-line-val">{termine.filter((t) => t.status === "BESTAETIGT").length}</b>
                </span>
                <span>
                    <span className="termin-stat-line-label">{t("termin.calendar.free")}</span>
                    <b className="termin-stat-line-val">{freiH}h</b>
                </span>
            </div>
        </>
    );

    const naechsterTerminBlock = (
        <>
            <div className="termin-side-h3">{t("termin.calendar.next_title")}</div>
            {nextAppt ? (
                <>
                    <div className="termin-next-time">{nextAppt.uhrzeit.slice(0, 5)}</div>
                    <div className="termin-next-name">{patientNameById.get(nextAppt.patient_id) ?? "Patient"}</div>
                    <div className="termin-next-meta">
                        {terminArtLabelFromTermin(nextAppt)} · {aerzte.find((a) => a.id === nextAppt.arzt_id)?.name ?? ""}
                    </div>
                </>
            ) : sortedToday.length > 0 ? (
                <p className="termin-next-empty">{t("termin.calendar.next_empty_later")}</p>
            ) : (
                <p className="termin-next-empty">{t("termin.calendar.next_empty_today")}</p>
            )}
        </>
    );

    return (
        <div ref={splitRef} className={`termin-day-split fade-up${compactChrome ? " termin-day-split--compact" : ""}`}>
            <div className="card card-pad termin-day-main">
                <div className="termin-day-split-head">
                    <div>
                        <div className="card-title">{format(dayDate, "EEEE, d. MMMM yyyy", { locale: dateFnsLocale })}</div>
                        <div className="card-sub">
                            {tp("termin.calendar.day_subtitle", { planned: planned.length, confirmed: bestaetigt })}
                        </div>
                    </div>
                    <DoctorLegend aerzte={aerzte} arztToneMap={arztToneMap} />
                </div>
                {sortedToday.length === 0 ? (
                    <div className="termin-day-empty">
                        <EmptyState
                            graphic={(
                                <span className="empty-state-icon-calendar" aria-hidden>
                                    <CalendarIcon size={34} />
                                </span>
                            )}
                            title={t("termin.calendar.empty_day")}
                            description={emptyDescription}
                        />
                        <div className="schedule-day-empty-actions">
                            <Button type="button" onClick={onEmptyCreate}>{t("termin.calendar.create")}</Button>
                            {emptyHasFilters && onEmptyResetFilters ? (
                                <Button type="button" variant="ghost" onClick={onEmptyResetFilters}>{t("common.reset_filters")}</Button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="termin-day-timeline-host" ref={dayTimelineRef} data-termin-day-canvas="1">
                        <div className="termin-week-body-grid termin-day-body-grid">
                            <div className="termin-week-hours termin-day-hours">
                                <div className="termin-day-hours-stack" data-termin-hour-gutter="1">
                                    {hourLabels.map((h) => (
                                        <div key={h} className="termin-hour-label termin-day-hour-label" style={{ height: dayAxisLayout.hourPx }}>
                                            {`${String(h).padStart(2, "0")}:00`}
                                        </div>
                                    ))}
                                    <TerminHourGutterSnap
                                        startMin={hourGutterSnapMin}
                                        pxPerMin={dayAxisLayout.pxPerMin}
                                        phase={hourGutterPhase}
                                        dayStartMin={timelineBounds.startMin}
                                    />
                                </div>
                            </div>
                            <TerminTimeColumnBody
                                iso={iso}
                                termine={termine}
                                patientNameById={patientNameById}
                                arztToneMap={arztToneMap}
                                arztNameById={arztNameById}
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
                                praxisCfg={praxisCfg}
                            />
                        </div>
                    </div>
                )}
            </div>
            <aside className="termin-day-sidebar" aria-label={t("termin.calendar.day_overview_aria")}>
                {miniMonthCard}
                {compactChrome ? (
                    <div className="card card-pad termin-day-sidebar__summary termin-next-card">
                        {tagesuebersichtBlock}
                        <div className="termin-day-sidebar__next" style={{ marginTop: 12 }}>
                            {naechsterTerminBlock}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="card card-pad">{tagesuebersichtBlock}</div>
                        <div className="card card-pad termin-next-card">{naechsterTerminBlock}</div>
                    </>
                )}
            </aside>
        </div>
    );
}
