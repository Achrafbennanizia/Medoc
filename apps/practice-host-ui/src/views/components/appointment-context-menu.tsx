import { useT, isRtlLocale, useLocale } from "@/lib/i18n";
import type { Appointment } from "@/models/types";
import { appointmentKindLabelFromAppointment } from "@/lib/appointment-calendar-ui";

export type AppointmentContextMenuProps = {
    appointment: Appointment;
    x: number;
    y: number;
    patientName: string;
    onClose: () => void;
    onOpenDetails: () => void;
    onEdit: () => void;
    onStornieren: () => void;
    onReminder: () => void;
};

export function AppointmentContextMenu({
    appointment,
    x,
    y,
    patientName,
    onClose,
    onOpenDetails,
    onEdit,
    onStornieren,
    onReminder,
}: AppointmentContextMenuProps) {
    const t = useT();
    const rtl = useLocale((s) => isRtlLocale(s.locale));
    const menuWidth = 240;
    const menuHeight = 320;
    const maxX = typeof window !== "undefined" ? window.innerWidth - menuWidth : x;
    const maxY = typeof window !== "undefined" ? window.innerHeight - menuHeight : y;
    const clampedX = Math.max(8, Math.min(x, maxX));
    const clampedY = Math.max(8, Math.min(y, maxY));
    const left = rtl && typeof window !== "undefined"
        ? Math.max(8, Math.min(window.innerWidth - clampedX - menuWidth, maxX))
        : clampedX;
    const top = clampedY;
    return (
        <div className="menu appointment-ctx-menu" style={{ position: "fixed", left, top }}>
            <div className="appointment-ctx-title">{patientName}</div>
            <div className="appointment-ctx-sub">
                {appointment.time.slice(0, 5)} · {appointmentKindLabelFromAppointment(appointment)}
            </div>
            <button type="button" className="menu-item" onClick={() => { onOpenDetails(); onClose(); }}>{t("appointment.context.open_details")}</button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { onEdit(); onClose(); }}>{t("appointment.context.edit")}</button>
            <button type="button" className="menu-item" onClick={() => { onReminder(); onClose(); }}>{t("appointment.drawer.reminder")}</button>
            <button type="button" className="menu-item danger" onClick={() => { onStornieren(); onClose(); }}>{t("appointment.drawer.cancel")}</button>
        </div>
    );
}
