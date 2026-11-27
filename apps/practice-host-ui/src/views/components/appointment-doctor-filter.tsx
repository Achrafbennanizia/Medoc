import { useT } from "@/lib/i18n";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";

type AppointmentDoctorFilterProps = {
    physicians: readonly PhysicianSummary[];
    selectedIds: readonly string[];
    onToggle: (physicianId: string) => void;
};

/** Doctor section of the calendar filter popover. Renders nothing in single-doctor editions. */
export function AppointmentDoctorFilter({ physicians, selectedIds, onToggle }: AppointmentDoctorFilterProps) {
    const t = useT();
    if (!DOCTOR_CONTEXT.showDoctorUi) return null;
    return (
        <>
            <div className="appointment-filter-popover-section">
                <div className="appointment-filter-popover-label">{t("appointments.filter.doctor")}</div>
                {physicians.length === 0 ? (
                    <div className="appointment-filter-empty">{t("appointments.filter.no_doctors")}</div>
                ) : (
                    physicians.map((a) => (
                        <label key={a.id} className="menu-item appointment-filter-check-row">
                            <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => onToggle(a.id)} />
                            <span>{a.name}</span>
                        </label>
                    ))
                )}
            </div>
            <div className="menu-sep" />
        </>
    );
}
