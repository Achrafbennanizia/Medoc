import { useT } from "@/lib/i18n";
import type { Patient, Staff } from "@/models/types";
import type { PracticeTaskStatus, PracticeTaskKind } from "@/systems/practice-host/controllers/practice-task.controller";
import { Input, Select, Textarea } from "../ui/input";
import {
    TASK_NO_PATIENT_VALUE,
    PRACTICE_TASK_KINDS,
    selectableTaskStatuses,
    type PracticeTaskTaskForm,
} from "./constants";

type Props = {
    mode: "create" | "edit";
    form: PracticeTaskTaskForm;
    patients: Patient[];
    staff: Staff[];
    canAdminStatus?: boolean;
    canFulfillStatus?: boolean;
    onChange: (patch: Partial<PracticeTaskTaskForm>) => void;
};

export function PracticeTaskFormFields({
    mode,
    form,
    patients,
    staff,
    canAdminStatus = false,
    canFulfillStatus = false,
    onChange,
}: Props) {
    const t = useT();
    const kindOptions = PRACTICE_TASK_KINDS.map((row) => ({
        value: row.value,
        label: t(`practice.tasks.kind.${row.value.toLowerCase()}`),
    }));
    const statusOptions =
        mode === "edit"
            ? selectableTaskStatuses({
                  current: form.status,
                  canAdminStatus,
                  canFulfillStatus,
              }).map((s) => ({
                  value: s.value,
                  label: t(`practice.tasks.status.${s.value.toLowerCase()}`),
              }))
            : [];

    return (
        <div className="practice-task-form-fields">
            {mode === "create" ? (
                <Select
                    id="task-patient"
                    label={t("common.patient")}
                    value={form.patientId}
                    onChange={(e) => onChange({ patientId: e.target.value })}
                    options={[
                        { value: TASK_NO_PATIENT_VALUE, label: t("practice.tasks.form.no_patient") },
                        ...patients.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                />
            ) : null}
            <Input
                id="task-title"
                label={t("common.title_field")}
                value={form.title}
                onChange={(e) => onChange({ title: e.target.value })}
            />
            <Textarea
                id="task-body"
                label={t("common.description")}
                rows={4}
                value={form.body}
                onChange={(e) => onChange({ body: e.target.value })}
            />
            <div className="practice-task-form-fields__row">
                <Select
                    id="task-kind"
                    label={t("common.type")}
                    value={form.kind}
                    onChange={(e) => onChange({ kind: e.target.value as PracticeTaskKind })}
                    options={kindOptions}
                />
                {mode === "edit" && statusOptions.length > 1 ? (
                    <Select
                        id="task-status"
                        label={t("common.status")}
                        value={form.status}
                        onChange={(e) => onChange({ status: e.target.value as PracticeTaskStatus })}
                        options={statusOptions}
                    />
                ) : null}
            </div>
            <div className="practice-task-form-fields__row">
                <Select
                    id="task-assignee-mode"
                    label={t("practice.tasks.form.assignee")}
                    value={form.assigneeMode}
                    onChange={(e) =>
                        onChange({ assigneeMode: e.target.value as PracticeTaskTaskForm["assigneeMode"] })
                    }
                    options={[
                        { value: "reception", label: t("practice.tasks.form.assignee_pool") },
                        { value: "user", label: t("practice.tasks.form.assignee_user") },
                    ]}
                />
                {form.assigneeMode === "user" ? (
                    <Select
                        id="task-assignee-user"
                        label={t("common.person")}
                        value={form.assigneeUserId}
                        onChange={(e) => onChange({ assigneeUserId: e.target.value })}
                        options={[
                            { value: "", label: t("practice.tasks.form.pick_person") },
                            ...staff.map((m) => {
                                const roleKey = `enum.role.${m.role.toLowerCase()}`;
                                const roleLabel = t(roleKey);
                                const role = roleLabel === roleKey ? m.role : roleLabel;
                                return { value: m.id, label: `${m.name} (${role})` };
                            }),
                        ]}
                    />
                ) : null}
            </div>
        </div>
    );
}
