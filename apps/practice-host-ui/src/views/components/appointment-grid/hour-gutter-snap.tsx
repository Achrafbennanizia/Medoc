/** Time label that follows the pointer in the hour gutter while dragging an appointment. */
import { useEffect, useState } from "react";
import { minutesToTime } from "@/lib/appointment-availability";
import { subscribeAppointmentHourGutterSnap } from "@/lib/appointment-drag-runtime";

export function AppointmentHourGutterSnap(props: {
    startMin: number | null;
    pxPerMin: number;
    phase: "drag" | "placed" | null;
    dayStartMin: number;
}) {
    const { startMin, pxPerMin, phase, dayStartMin } = props;
    const [dragMin, setDragMin] = useState<number | null>(null);
    useEffect(() => {
        if (phase !== "drag") {
            setDragMin(null);
            return;
        }
        return subscribeAppointmentHourGutterSnap((min) => {
            setDragMin((prev) => (prev === min ? prev : min));
        });
    }, [phase]);
    const shown = phase === "drag" && dragMin != null ? dragMin : startMin;
    if (shown == null || phase == null) return null;
    return (
        <div
            className={`appointment-hour-gutter-snap appointment-hour-gutter-snap--${phase}`}
            style={{ top: (shown - dayStartMin) * pxPerMin }}
            aria-hidden
        >
            <span className="appointment-hour-gutter-snap__time">{minutesToTime(shown)}</span>
        </div>
    );
}
