import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import type { AppointmentDoctorTone } from "@/lib/appointment-calendar-ui";

export type DoctorLegendProps = {
    physicians: PhysicianSummary[];
    physicianToneMap: Map<string, AppointmentDoctorTone>;
};

export function DoctorLegend({ physicians, physicianToneMap }: DoctorLegendProps) {
    if (physicians.length === 0) return null;
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

