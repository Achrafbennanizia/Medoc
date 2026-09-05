import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import type { Appointment } from "@/models/types";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import {
    appointmentStateDisplay,
    minutesToTime,
    stateSoftPillClass,
    appointmentKindLabelFromAppointment,
    APPOINTMENT_DEFAULT_DUR_MIN,
    timeToMinutes,
} from "@/lib/appointment-calendar-ui";
import {
    BoltIcon,
    CheckIcon,
    EditIcon,
    EyeIcon,
    MailIcon,
    PhoneIcon,
    ShieldCheckIcon,
    XIcon,
} from "@/lib/icons";

function appointmentDrawerActiveStep(status: Appointment["status"]): number {
    if (status === "COMPLETED") return 3;
    if (status === "CONFIRMED") return 1;
    if (status === "PLANNED") return 0;
    if (status === "CANCELLED" || status === "NO_SHOW") return -1;
    return 0;
}

export type AppointmentDetailDrawerProps = {
    appointment: Appointment;
    patientName: string;
    patientPhone: string | null;
    doctorLabel: string;
    onClose: () => void;
    onEdit: () => void;
    onStornieren: () => void;
    onReminder: () => void;
    onStatusChange: (id: string, s: Appointment["status"]) => void;
    onPhone: () => void;
};

export function AppointmentDetailDrawer({
    appointment,
    patientName,
    patientPhone,
    doctorLabel,
    onClose,
    onEdit,
    onStornieren,
    onReminder,
    onStatusChange,
    onPhone,
}: AppointmentDetailDrawerProps) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const st = appointmentStateDisplay(appointment);
    const active = appointmentDrawerActiveStep(appointment.status);
    const duration = APPOINTMENT_DEFAULT_DUR_MIN;

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>(".appointment-drawer-head .icon-btn");
            closeBtn?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const layer = (
        <div className="appointment-drawer-root" role="presentation">
            <button type="button" className="appointment-drawer-backdrop" aria-label={t("appointment.drawer.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="appointment-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="appointment-drawer-body-scroll">
                    <div className="appointment-drawer-head">
                        <span className={`pill ${stateSoftPillClass(appointment)}`}>{st.label}</span>
                        <button type="button" className="icon-btn" aria-label={t("appointment.drawer.close")} onClick={onClose}>
                            <XIcon size={18} />
                        </button>
                    </div>
                    <div className="appointment-drawer-section">
                        <div className="appointment-drawer-eyebrow">{t("appointment.drawer.appointment")}</div>
                        <h2 id={titleId} className="appointment-drawer-title">{patientName}</h2>
                        <div className="appointment-drawer-sub">{appointmentKindLabelFromAppointment(appointment)}</div>
                    </div>
                    <div className="appointment-drawer-meta-row">
                        <div>
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.date")}</div>
                            <div className="appointment-drawer-meta-val">{format(parseISO(appointment.date), "d. MMMM yyyy", { locale: dateFnsLocale })}</div>
                        </div>
                        <div>
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.time")}</div>
                            <div className="appointment-drawer-meta-val">
                                {appointment.time.slice(0, 5)} – {minutesToTime(timeToMinutes(appointment.time) + duration)}
                            </div>
                        </div>
                        <div>
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.duration")}</div>
                            <div className="appointment-drawer-meta-val">{tp("appointment.drawer.duration_min", { min: duration })}</div>
                        </div>
                    </div>
                    <div className="appointment-drawer-section">
                        <div className="appointment-drawer-eyebrow">{t("appointment.drawer.workflow")}</div>
                        <div className="appointment-workflow-simple">
                            {([
                                t("appointment.drawer.workflow.planned"),
                                t("appointment.drawer.workflow.confirmed"),
                                t("appointment.drawer.workflow.active"),
                                t("appointment.drawer.workflow.done"),
                            ] as const).map((label, i) => (
                                <div key={label} className="appointment-workflow-step">
                                    <button
                                        type="button"
                                        className={`appointment-workflow-node ${i <= active ? "on" : ""} ${i === active ? "current" : ""}`}
                                        title={label}
                                        onClick={() => {
                                            const map: Appointment["status"][] = ["PLANNED", "CONFIRMED", "CONFIRMED", "COMPLETED"];
                                            onStatusChange(appointment.id, map[i]!);
                                        }}
                                    >
                                        {i === 0 ? <CheckIcon size={14} /> : i === 1 ? <EyeIcon size={14} /> : i === 2 ? <BoltIcon size={14} /> : <ShieldCheckIcon size={14} />}
                                    </button>
                                    <span className="appointment-workflow-label">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.provider")}</div>
                            <div className="appointment-drawer-meta-val">{doctorLabel}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.patient_phone")}</div>
                            <div className="appointment-drawer-meta-val">{patientPhone ?? "—"}</div>
                        </div>
                        <div className="ios-row">
                            <div className="appointment-drawer-eyebrow">{t("appointment.drawer.treatment_type")}</div>
                            <div className="appointment-drawer-meta-val">{appointmentKindLabelFromAppointment(appointment)}</div>
                        </div>
                    </div>
                    {appointment.notes?.trim() ? (
                        <div className="appointment-drawer-note">
                            <div className="appointment-drawer-note-title">{t("appointment.drawer.note")}</div>
                            <p>{appointment.notes}</p>
                        </div>
                    ) : null}
                    <div className="appointment-drawer-actions row">
                        <button type="button" className="btn btn-subtle" onClick={onPhone}>
                            <PhoneIcon size={14} />
                            {t("appointment.drawer.call")}
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onReminder}>
                            <MailIcon size={14} />
                            {t("appointment.drawer.reminder")}
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onEdit}>
                            <EditIcon size={14} />
                            {t("appointment.drawer.edit")}
                        </button>
                    </div>
                </div>
                <div className="appointment-drawer-panel-foot">
                    <div className="appointment-drawer-footer row">
                        {appointment.status === "PLANNED" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(appointment.id, "CONFIRMED")}>{t("appointment.drawer.confirm")}</button>
                        ) : null}
                        {appointment.status === "CONFIRMED" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(appointment.id, "COMPLETED")}>{t("appointment.drawer.finish")}</button>
                        ) : null}
                        <button type="button" className="btn btn-subtle danger" onClick={onStornieren}>{t("appointment.drawer.cancel")}</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}
