import { useT } from "@/lib/i18n";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { Select } from "./ui/input";

type DoctorSelectProps = {
    id: string;
    label: string;
    value: string;
    onChange: (physicianId: string) => void;
    physicians: readonly PhysicianSummary[];
    /** Label of the empty choice; defaults to the booking form's "pick a doctor" / "no doctors". */
    emptyLabel?: string;
};

/** Doctor picker. Renders nothing in single-doctor editions (doctor-context.ts). */
export function DoctorSelect({ id, label, value, onChange, physicians, emptyLabel }: DoctorSelectProps) {
    const t = useT();
    if (!DOCTOR_CONTEXT.showDoctorUi) return null;
    const empty = emptyLabel ?? t(physicians.length ? "appointment.create.doctor_pick" : "appointment.create.doctor_empty");
    return (
        <Select
            id={id}
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={[{ value: "", label: empty }, ...physicians.map((a) => ({ value: a.id, label: a.name }))]}
        />
    );
}
