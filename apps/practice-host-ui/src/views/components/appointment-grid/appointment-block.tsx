/** One appointment on the timeline (week and day view); content fits its own size via CSS. */
import { type CSSProperties, type MouseEvent as ReactMouseEvent, memo } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { extractToothacheFdisFromChiefComplaint, formatDentalToothLabel, formatDentalToothList } from "@/lib/dental";
import { appointmentIsEmergencyMarked } from "@/lib/appointment-domain";
import { blockToneForAppointment, doctorStripeVar, appointmentKindLabelFromAppointment, appointmentCalendarStatusPill, APPOINTMENT_DEFAULT_DUR_MIN, type AppointmentDoctorTone } from "@/lib/appointment-calendar-ui";
import type { Appointment } from "@/models/types";
import { BoltIcon } from "@/lib/icons";
import { clearAppointmentMagnify, placeAppointmentMagnify } from "./appointment-block-magnify";

export const AppointmentApptBlockView = memo(function AppointmentApptBlockView({
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
    onClick: (e: ReactMouseEvent) => void;
    onMouseDown: (e: ReactMouseEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
}) {
    const t = useT();
    const tp = useTParams();
    const blockTone = blockToneForAppointment(appointment, doctorTone);
    const cancelled = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
    const durMin = daySlotDurationMin ?? APPOINTMENT_DEFAULT_DUR_MIN;
    const timeStr = (dragPreviewTime ?? appointment.time).slice(0, 5);
    const pill = appointmentCalendarStatusPill(appointment);
    const stripeColor = doctorStripeVar(doctorTone);
    const weekView = !dayColumn;
    const painTeeth = extractToothacheFdisFromChiefComplaint(appointment.chief_complaint);
    const kindLabel = appointmentKindLabelFromAppointment(appointment);
    const durLabel = tp("appointment.drawer.duration_min", { min: durMin });
    const toothLabel = painTeeth.length
        ? painTeeth.length === 1
            ? tp("dental.picker.one_tooth", { tooth: formatDentalToothLabel(painTeeth[0]!, t) })
            : tp("dental.picker.many_teeth", { teeth: formatDentalToothList(painTeeth, t) })
        : null;
    const a11ySummary = [timeStr, durLabel, patientName, kindLabel, pill.label, pill.rescheduled ? t("status.appointment.flag.rescheduled") : null, toothLabel, dragTargetDateHint]
        .filter(Boolean)
        .join(" · ");

    const emergencyIc = appointmentIsEmergencyMarked(appointment) ? (
        <span className="appointment-appt-block-emergency-ic" aria-hidden>
            <BoltIcon size={10} />
        </span>
    ) : null;

    const rescheduledLabel = pill.rescheduled ? t("status.appointment.flag.rescheduled") : null;
    const statusPill = weekView ? (
        <span className="sr-only">{[pill.label, rescheduledLabel].filter(Boolean).join(" · ")}</span>
    ) : (
        <span className={`appointment-appt-status-pill appointment-appt-status-pill--${pill.tone}`}>
            {pill.label}
            {rescheduledLabel ? (
                <span className="appointment-appt-status-flag" title={rescheduledLabel} aria-label={rescheduledLabel}>
                    ↻
                </span>
            ) : null}
        </span>
    );

    const timeLiveClass = dragPreviewTime ? " appointment-appt-block-time--drag-live" : "";

    const dragHintInline = dragTargetDateHint ? (
        <>
            <span className="appointment-appt-block-micro-sep" aria-hidden>
                ·
            </span>
            <span className="appointment-appt-block-target-day">{dragTargetDateHint}</span>
        </>
    ) : null;

    // Three lines (time · duration / patient / treatment); CSS container queries on the block's own size
    // decide how many fit (pages/appointments-cards.css, "Appointment block — fit to space").
    const inner = (
        <>
            <span className="appointment-appt-block-stripe" style={{ background: stripeColor }} aria-hidden />
            <span className="appt-fit">
                <span className="appt-fit__meta">
                    <span className={`appointment-appt-block-time${timeLiveClass}`}>{timeStr}</span>
                    {/* Filled by the drag runtime between renders; React never writes into it. */}
                    <span className="appointment-appt-block-time-live" aria-hidden />
                    <span className="appointment-appt-block-micro-sep appt-fit__dur" aria-hidden>
                        ·
                    </span>
                    <span className="appointment-appt-block-duration appt-fit__dur">{durLabel}</span>
                    {dragHintInline}
                </span>
                <span className="appt-fit__name">
                    {emergencyIc}
                    <span className="appointment-appt-block-name">{patientName}</span>
                </span>
                <span className="appt-fit__type appointment-appt-block-type">{kindLabel}</span>
            </span>
            {weekView ? statusPill : <span className="appt-fit__status">{statusPill}</span>}
        </>
    );

    return (
        <button
            type="button"
            data-appointment-appt-id={appointment.id}
            data-appointment-density="fit"
            aria-label={a11ySummary}
            className={[
                "appointment-appt-block",
                "appointment-appt-block--fit",
                dayColumn ? "appointment-appt-block--day" : "appointment-appt-block--week",
                `appointment-appt-block--${blockTone}`,
                cancelled ? "appointment-appt-block--cancelled" : "",
                dragging ? "appointment-appt-block--dragging" : "",
                dragging && dragInvalid ? "appointment-appt-block--drag-invalid" : "",
                weekView ? `appointment-appt-status-surface--${pill.tone}` : "",
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
            onClick={onClick}
            onMouseEnter={(e) => placeAppointmentMagnify(e.currentTarget)}
            onMouseLeave={(e) => clearAppointmentMagnify(e.currentTarget)}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
        >
            <span className="appointment-appt-block-shell">{inner}</span>
        </button>
    );
});
