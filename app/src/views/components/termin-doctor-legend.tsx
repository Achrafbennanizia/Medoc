import type { AerztSummary } from "@/systems/practice-host/controllers/personal.controller";
import type { TerminDoctorTone } from "@/lib/termin-calendar-ui";

export type DoctorLegendProps = {
    aerzte: AerztSummary[];
    arztToneMap: Map<string, TerminDoctorTone>;
};

export function DoctorLegend({ aerzte, arztToneMap }: DoctorLegendProps) {
    if (aerzte.length === 0) return null;
    return (
        <div className="termin-doctor-legend">
            {aerzte.slice(0, 8).map((a) => {
                const tone = arztToneMap.get(a.id) ?? "accent";
                return (
                    <span key={a.id} className="termin-legend-item">
                        <span className={`termin-legend-dot termin-legend-dot--${tone}`} aria-hidden />
                        {a.name}
                    </span>
                );
            })}
        </div>
    );
}

