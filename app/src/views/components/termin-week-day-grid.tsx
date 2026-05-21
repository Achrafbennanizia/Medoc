import {
    type CSSProperties,
    type Dispatch,
    type MutableRefObject,
    type MouseEvent as ReactMouseEvent,
    type SetStateAction,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { addDays, addMonths, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { AerztSummary } from "@/controllers/personal.controller";
import { extractZahnschmerzFdisFromBeschwerden } from "@/lib/dental";
import { terminIstNotfallMarkiert } from "@/lib/termin-domain";
import { minutesToUhrzeit } from "@/lib/termin-availability";
import {
    blockToneForTermin,
    calendarMonthOffsetFromToday,
    doctorStripeVar,
    terminArtLabelFromTermin,
    terminCalendarStatusPill,
    terminCountsAsPlanned,
    TERMIN_DAY_END_MIN,
    TERMIN_DAY_START_MIN,
    TERMIN_DEFAULT_DUR_MIN,
    TERMIN_HOUR_PX,
    TERMIN_PX_PER_MIN,
    terminUhrzeitToMinutes,
    type TerminDoctorTone,
} from "@/lib/termin-calendar-ui";
import type { Termin } from "@/models/types";
import { BoltIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { EmptyState } from "@/views/components/ui/empty-state";
import { DoctorLegend } from "@/views/components/termin-doctor-legend";

const PX_PER_MIN = TERMIN_PX_PER_MIN;
const DAY_START_MIN = TERMIN_DAY_START_MIN;
const DAY_END_MIN = TERMIN_DAY_END_MIN;
const HOUR_PX = TERMIN_HOUR_PX;
const uhrzeitToMinutes = terminUhrzeitToMinutes;

export type TerminDragState = {
    id: string;
    datum: string;
    durMin: number;
    originalDatum: string;
    originalStartMin: number;
    currentDatum: string;
    currentStartMin: number;
};

function useDayTimelineLayout() {
    const hostRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState(() => ({ hourPx: HOUR_PX, pxPerMin: PX_PER_MIN }));
    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const apply = () => {
            const h = el.clientHeight;
            const slots = (DAY_END_MIN - DAY_START_MIN) / 60;
            if (h < 40) return;
            const hourPx = h / slots;
            setLayout({ hourPx, pxPerMin: hourPx / 60 });
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return { hostRef, layout };
}

/** Tag-Ansicht: unter dieser Höhe kompakte Seitenleiste (Scroll + verdichtete Karten). */
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
}) {
    const { startMin, pxPerMin, phase } = props;
    if (startMin == null || phase == null) return null;
    return (
        <div
            className={`termin-hour-gutter-snap termin-hour-gutter-snap--${phase}`}
            style={{ top: (startMin - DAY_START_MIN) * pxPerMin }}
            aria-hidden
        >
            <span className="termin-hour-gutter-snap__time">{minutesToUhrzeit(startMin)}</span>
        </div>
    );
}

function TerminApptBlockView({
    termin,
    patientName,
    doctorTone,
    dayColumn,
    daySlotDurationMin,
    dragPreviewUhrzeit,
    dragging,
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
    /** Tagesansicht: Kurzdatum des Ziels wenn per Drag ein anderer Tag gewählt wird */
    dragTargetDatumHint?: string;
    style?: CSSProperties;
    onClick: () => void;
    onMouseDown: (e: ReactMouseEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
}) {
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
            className={`termin-appt-block termin-appt-block--calendar-row ${dayColumn ? "termin-appt-block--day-tall" : "termin-appt-block--week-compact"} termin-appt-block--${blockTone}${cancelled ? " termin-appt-block--cancelled" : ""}${dragging ? " termin-appt-block--dragging" : ""}${weekCompact ? ` termin-appt-status-surface--${pill.tone}` : ""}`}
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
                <span className="termin-appt-block-type">{terminArtLabelFromTermin(termin)}</span>
                {schmerzZaehne.length ? (
                    <span
                        className="termin-appt-block-zahn"
                        title={`Zahnschmerz · FDI ${schmerzZaehne.join(", ")}`}
                    >
                        {schmerzZaehne.length === 1 ? `Zahn ${schmerzZaehne[0]}` : `Zähne ${schmerzZaehne.join(", ")}`}
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
}

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
}: {
    iso: string;
    termine: Termin[];
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, TerminDoctorTone>;
    arztNameById?: Map<string, string>;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    /** Tagesansicht: Stunden-Snap zurücksetzen wenn ein Termin-Block zum Ziehen gegriffen wird */
    onBeginAppointmentDrag?: () => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (isoDay: string, startMin: number) => void;
    nowMin: () => number;
    singleDay: boolean;
    /** Wochenansicht: erster Klick nach Drag-Drop verwerfen (s. Parent-Ref). */
    clickSuppressUntilRef?: MutableRefObject<number>;
    /** Tag- und Wochenansicht: Stundenhöhe aus verfügbarem Raster (ResizeObserver) */
    axisLayout?: { hourPx: number; pxPerMin: number };
}) {
    const hourPx = axisLayout?.hourPx ?? HOUR_PX;
    const pxPerMin = axisLayout?.pxPerMin ?? PX_PER_MIN;
    const axisHeightPx = ((DAY_END_MIN - DAY_START_MIN) / 60) * hourPx;
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const isTodayCol = iso === todayIso;
    const isWeekend = [0, 6].includes(parseISO(iso).getDay());
    const dayList = useMemo(() => [...termine].sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit)), [termine]);
    const nMin = nowMin();

    const onColDblClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const y = e.clientY - r.top;
        const raw = DAY_START_MIN + y / pxPerMin;
        const snapped = Math.round(raw / 15) * 15;
        const lo = DAY_START_MIN;
        const hi = DAY_END_MIN - 15;
        const start = Math.max(lo, Math.min(snapped, hi));
        onNewAt(iso, start);
    };

    return (
        <div
            className={`termin-day-col ${isTodayCol ? "termin-day-col--today" : ""} ${isWeekend ? "termin-day-col--weekend" : ""}`}
            data-termin-day-col={iso}
            data-single-day={singleDay ? "1" : undefined}
            style={{ minHeight: axisHeightPx }}
            onDoubleClick={onColDblClick}
            role="presentation"
        >
            {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }).map((_, i) => (
                <div key={i} className="termin-hour-line" style={{ top: i * hourPx }} />
            ))}
            {isTodayCol && nMin >= DAY_START_MIN && nMin <= DAY_END_MIN ? (
                <div className="termin-now-line" style={{ top: (nMin - DAY_START_MIN) * pxPerMin }}>
                    <span className="termin-now-dot" />
                    {!singleDay ? null : (
                        <span className="termin-now-pill">
                            {minutesToUhrzeit(nMin)} jetzt
                        </span>
                    )}
                </div>
            ) : null}
            {dayList.map((ap) => {
                if (!singleDay && dragState && dragState.id === ap.id && dragState.currentDatum !== iso) return null;
                const st = uhrzeitToMinutes(ap.uhrzeit);
                const docTone = arztToneMap.get(ap.arzt_id) ?? "accent";
                const isDragThis = dragState?.id === ap.id;
                const dispStart = isDragThis ? dragState!.currentStartMin : st;
                const top = (dispStart - DAY_START_MIN) * pxPerMin;
                const dur = TERMIN_DEFAULT_DUR_MIN;
                const minDayBlockPx = singleDay ? Math.max(56, pxPerMin * 24) : 0;
                const minWeekBlockPx = singleDay ? 0 : 48;
                const blockHeight = Math.max(dur * pxPerMin - 2, singleDay ? minDayBlockPx : minWeekBlockPx);
                const targetDayHint =
                    singleDay && isDragThis && dragState && dragState.currentDatum !== iso
                        ? `→ ${format(parseISO(dragState.currentDatum), "EEE d. MMM", { locale: de })}`
                        : undefined;
                return (
                    <TerminApptBlockView
                        key={ap.id}
                        termin={ap}
                        patientName={patientNameById.get(ap.patient_id) ?? "Patient"}
                        doctorName={arztNameById?.get(ap.arzt_id)}
                        doctorTone={docTone}
                        compact={!singleDay}
                        dayColumn={singleDay}
                        daySlotDurationMin={dur}
                        dragPreviewUhrzeit={isDragThis ? minutesToUhrzeit(dispStart) : undefined}
                        dragging={isDragThis}
                        dragTargetDatumHint={targetDayHint}
                        style={{
                            top,
                            height: blockHeight,
                            left: 4,
                            right: 4,
                        }}
                        onClick={() => {
                            if (clickSuppressUntilRef && Date.now() < clickSuppressUntilRef.current) return;
                            onOpenDrawer(ap);
                        }}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            onBeginAppointmentDrag?.();
                            setDragState({
                                id: ap.id,
                                datum: iso,
                                durMin: dur,
                                originalDatum: ap.datum,
                                originalStartMin: st,
                                currentDatum: ap.datum,
                                currentStartMin: st,
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
    clickSuppressUntilRef: MutableRefObject<number>;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    snapLabel: { iso: string; startMin: number } | null;
    onClearSnapLabel: () => void;
    onHeaderDay: (iso: string) => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    nowMin: () => number;
}) {
    const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const byDate = useMemo(() => {
        const acc: Record<string, Termin[]> = {};
        for (const t of termine) {
            (acc[t.datum] ??= []).push(t);
        }
        return acc;
    }, [termine]);

    const { hostRef: weekTimelineRef, layout: weekAxisLayout } = useDayTimelineLayout();
    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : snapLabel?.startMin ?? null;
    const hourGutterPhase: "drag" | "placed" | null = dragState != null ? "drag" : snapLabel != null ? "placed" : null;

    return (
        <div className="card card-pad termin-week-card fade-up">
            <div className="termin-week-head-grid">
                <div className="termin-week-corner" aria-hidden />
                {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const isToday = iso === format(new Date(), "yyyy-MM-dd");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const dow = format(d, "EEEEE", { locale: de }).toUpperCase();
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`termin-week-dow ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}
                            onClick={() => onHeaderDay(iso)}
                        >
                            <span className="termin-week-dow-short">{dow}</span>
                            <span className="termin-week-dow-num">{format(d, "d", { locale: de })}</span>
                        </button>
                    );
                })}
            </div>
            <div className="termin-week-body" ref={weekTimelineRef}>
                <div className="termin-week-body-grid" data-termin-week-canvas="1">
                    <div className="termin-week-hours">
                        <div className="termin-week-hours-stack" data-termin-hour-gutter="1">
                            {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => {
                                const h = 8 + i;
                                return (
                                    <div key={h} className="termin-hour-label" style={{ height: weekAxisLayout.hourPx }}>
                                        {`${String(h).padStart(2, "0")}:00`}
                                    </div>
                                );
                            })}
                            <TerminHourGutterSnap startMin={hourGutterSnapMin} pxPerMin={weekAxisLayout.pxPerMin} phase={hourGutterPhase} />
                        </div>
                    </div>
                    {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const baseList = byDate[iso] ?? [];
                        const columnTermine =
                            dragState != null && dragState.currentDatum === iso && !baseList.some((x) => x.id === dragState.id)
                                ? (() => {
                                      const ghost = termine.find((x) => x.id === dragState.id);
                                      return ghost ? [...baseList, ghost] : baseList;
                                  })()
                                : baseList;
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
    monthOffset: number;
    onMonthOffsetChange: Dispatch<SetStateAction<number>>;
    daySnapLabel: { iso: string; startMin: number } | null;
    onClearDaySnapLabel: () => void;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    emptyDescription: string;
    emptyHasFilters: boolean;
    onEmptyCreate: () => void;
    onEmptyResetFilters?: () => void;
    nowMin: () => number;
}) {
    const iso = format(dayDate, "yyyy-MM-dd");
    const { hostRef: dayTimelineRef, layout: dayAxisLayout } = useDayTimelineLayout();
    const arztNameById = useMemo(() => new Map(aerzte.map((a) => [a.id, a.name])), [aerzte]);
    const planned = termine.filter(terminCountsAsPlanned);
    const bestaetigt = termine.filter((t) => t.status === "BESTAETIGT").length;
    const slotMin = (DAY_END_MIN - DAY_START_MIN);
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
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <button type="button" className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onMonthOffsetChange((o) => o - 1)}>
                    <ChevronLeftIcon size={16} />
                </button>
                <span className="termin-mini-month-title">{format(first, "MMMM yyyy", { locale: de })}</span>
                <button type="button" className="icon-btn" aria-label="Nächster Monat" onClick={() => onMonthOffsetChange((o) => o + 1)}>
                    <ChevronRightIcon size={16} />
                </button>
            </div>
            <div className="termin-mini-cal">
                {["MO", "DI", "MI", "DO", "FR", "SA", "SO"].map((d, i) => (
                    <div key={`${d}-${i}`} className="termin-mini-cal-head">{d}</div>
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
            <div className="termin-side-h3">Tagesübersicht</div>
            <div className="termin-stat-big">{planned.length}</div>
            <div className="termin-stat-big-label">Termine geplant</div>
            <div className="termin-stat-row termin-stat-row--day">
                <span>
                    <span className="termin-stat-line-label">Auslastung</span>
                    <b className="termin-stat-line-val">{auslastung}%</b>
                </span>
                <span>
                    <span className="termin-stat-line-label">Eingecheckt</span>
                    <b className="termin-stat-line-val">{termine.filter((t) => t.status === "BESTAETIGT").length}</b>
                </span>
                <span>
                    <span className="termin-stat-line-label">Frei</span>
                    <b className="termin-stat-line-val">{freiH}h</b>
                </span>
            </div>
        </>
    );

    const naechsterTerminBlock = (
        <>
            <div className="termin-side-h3">Nächster Termin</div>
            {nextAppt ? (
                <>
                    <div className="termin-next-time">{nextAppt.uhrzeit.slice(0, 5)}</div>
                    <div className="termin-next-name">{patientNameById.get(nextAppt.patient_id) ?? "Patient"}</div>
                    <div className="termin-next-meta">
                        {terminArtLabelFromTermin(nextAppt)} · {aerzte.find((a) => a.id === nextAppt.arzt_id)?.name ?? ""}
                    </div>
                </>
            ) : sortedToday.length > 0 ? (
                <p className="termin-next-empty">Kein weiterer Termin ab der aktuellen Uhrzeit.</p>
            ) : (
                <p className="termin-next-empty">Heute sind keine Termine in der Liste.</p>
            )}
        </>
    );

    return (
        <div ref={splitRef} className={`termin-day-split fade-up${compactChrome ? " termin-day-split--compact" : ""}`}>
            <div className="card card-pad termin-day-main">
                <div className="termin-day-split-head">
                    <div>
                        <div className="card-title">{format(dayDate, "EEEE, d. MMMM yyyy", { locale: de })}</div>
                        <div className="card-sub">
                            {planned.length} Termine · {bestaetigt} bestätigt
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
                            title="Keine Termine an diesem Tag"
                            description={emptyDescription}
                        />
                        <div className="schedule-day-empty-actions">
                            <Button type="button" onClick={onEmptyCreate}>Termin anlegen</Button>
                            {emptyHasFilters && onEmptyResetFilters ? (
                                <Button type="button" variant="ghost" onClick={onEmptyResetFilters}>Filter zurücksetzen</Button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="termin-day-timeline-host" ref={dayTimelineRef}>
                        <div className="termin-week-body-grid termin-day-body-grid">
                            <div className="termin-week-hours termin-day-hours">
                                <div className="termin-day-hours-stack" data-termin-hour-gutter="1">
                                    {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => {
                                        const h = 8 + i;
                                        return (
                                            <div key={h} className="termin-hour-label termin-day-hour-label" style={{ height: dayAxisLayout.hourPx }}>
                                                {`${String(h).padStart(2, "0")}:00`}
                                            </div>
                                        );
                                    })}
                                    <TerminHourGutterSnap startMin={hourGutterSnapMin} pxPerMin={dayAxisLayout.pxPerMin} phase={hourGutterPhase} />
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
                            />
                        </div>
                    </div>
                )}
            </div>
            <aside className="termin-day-sidebar" aria-label="Kalender und Tagesübersicht">
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
