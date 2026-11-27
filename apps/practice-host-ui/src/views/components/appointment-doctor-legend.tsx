import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import type { AppointmentDoctorTone } from "@/lib/appointment-calendar-ui";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import { useT } from "@/lib/i18n";

export type DoctorLegendProps = {
    physicians: PhysicianSummary[];
    physicianToneMap: Map<string, AppointmentDoctorTone>;
};

export function DoctorLegend({ physicians, physicianToneMap }: DoctorLegendProps) {
    if (!DOCTOR_CONTEXT.showDoctorUi || physicians.length === 0) return null;
    return (
        <div className="appointment-doctor-legend">
            {physicians.slice(0, 8).map((a) => {
                const tone = physicianToneMap.get(a.id) ?? "accent";
                return (
                    <span key={a.id} className="appointment-legend-item">
                        <span className={`appointment-legend-dot appointment-legend-dot--${tone}`} aria-hidden />
                        {a.name}
                    </span>
                );
            })}
        </div>
    );
}


/** Group calendar header: the legend doubles as the doctor filter. No chip pressed = everyone. */
export function DoctorFilterChips({
    physicians,
    physicianToneMap,
    selectedIds,
    onToggle,
}: DoctorLegendProps & { selectedIds: readonly string[]; onToggle: (physicianId: string) => void }) {
    const t = useT();
    if (!DOCTOR_CONTEXT.showDoctorUi || physicians.length === 0) return null;
    return (
        <div className="appointment-doctor-legend appointment-doctor-chips" role="group" aria-label={t("appointments.filter.doctor")}>
            {physicians.slice(0, 8).map((a) => {
                const tone = physicianToneMap.get(a.id) ?? "accent";
                const on = selectedIds.includes(a.id);
                return (
                    <button
                        key={a.id}
                        type="button"
                        className={`appointment-legend-item appointment-doctor-chip${on ? " is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => onToggle(a.id)}
                    >
                        <span className={`appointment-legend-dot appointment-legend-dot--${tone}`} aria-hidden />
                        {a.name}
                    </button>
                );
            })}
        </div>
    );
}
