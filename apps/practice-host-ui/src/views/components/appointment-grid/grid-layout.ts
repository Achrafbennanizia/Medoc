/** Timeline constants, drag state type and the layout hooks shared by week and day view. */
import { useLayoutEffect, useRef, useState } from "react";
import { APPOINTMENT_HOUR_PX, APPOINTMENT_PX_PER_MIN, type AppointmentTimelineBounds } from "@/lib/appointment-calendar-ui";

export const PX_PER_MIN = APPOINTMENT_PX_PER_MIN;
export const HOUR_PX = APPOINTMENT_HOUR_PX;

export type AppointmentDragState = {
    id: string;
    /** Doctor at drag start (source column). */
    physicianId: string;
    /** Doctor under the pointer while dragging (target column when applicable). */
    currentPhysicianId: string;
    date: string;
    durMin: number;
    originalDate: string;
    originalStartMin: number;
    currentDate: string;
    currentStartMin: number;
    dropAllowed: boolean;
};

export function useDayTimelineLayout(bounds: AppointmentTimelineBounds) {
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
export const APPOINTMENT_DAY_COMPACT_HEIGHT_PX = 680;

export function useAppointmentDayCompactChrome(hostRef: React.RefObject<HTMLDivElement | null>) {
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
