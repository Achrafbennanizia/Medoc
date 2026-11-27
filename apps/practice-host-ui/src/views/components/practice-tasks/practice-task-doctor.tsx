/**
 * Cabinet+ doctor filter / column for the task admin list (T5.4). Hidden in Essentiel and
 * Cabinet (one dentist; doctor-context.ts).
 */
import { useT, useTParams } from "@/lib/i18n";
import type { DoctorList } from "../use-doctor-list";
import { Select } from "../ui/input";

export type TaskDoctors = DoctorList;

export function TaskDoctorFilter({
    td,
    value,
    onChange,
    hidden = [],
}: {
    td: TaskDoctors;
    value: string;
    onChange: (id: string) => void;
    /** Doctors who do not share tasks with the viewer: picking them would only be refused. */
    hidden?: readonly string[];
}) {
    const t = useT();
    if (!td.show) return null;
    return (
        <Select
            id="tasks-filter-doctor"
            aria-label={t("practice.tasks.admin.filter_doctor_aria")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={[
                { value: "", label: t("practice.tasks.admin.all_doctors") },
                ...td.doctors.filter((d) => !hidden.includes(d.id)).map((d) => ({ value: d.id, label: d.name })),
            ]}
        />
    );
}

export function TaskDoctorCell({ td, doctorId }: { td: TaskDoctors; doctorId?: string | null }) {
    if (!td.show) return null;
    return <td className="tasks-td-doctor">{td.nameOf(doctorId) ?? "—"}</td>;
}

export function TaskHiddenDoctorsNote({ td, ids }: { td: TaskDoctors; ids: readonly string[] }) {
    const tp = useTParams();
    if (!td.show || ids.length === 0) return null;
    const names = ids.map((id) => td.nameOf(id) ?? id).join(", ");
    return (
        <p className="card-sub" role="status" style={{ margin: "0 0 var(--space-2)" }}>
            {tp("practice.tasks.admin.not_shared_by", { names })}
        </p>
    );
}
