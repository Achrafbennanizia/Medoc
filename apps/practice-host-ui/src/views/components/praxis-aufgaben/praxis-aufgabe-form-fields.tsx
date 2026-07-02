import { useT } from "@/lib/i18n";
import type { Patient, Personal } from "@/models/types";
import type { PraxisAufgabeStatus, PraxisAufgabeTyp } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { Input, Select, Textarea } from "../ui/input";
import {
    AUFGABE_NO_PATIENT_VALUE,
    PRAXIS_AUFGABE_TYPS,
    selectableAufgabeStatuses,
    type PraxisAufgabeTaskForm,
} from "./constants";

type Props = {
    mode: "create" | "edit";
    form: PraxisAufgabeTaskForm;
    patients: Patient[];
    personal: Personal[];
    canAdminStatus?: boolean;
    canFulfillStatus?: boolean;
    onChange: (patch: Partial<PraxisAufgabeTaskForm>) => void;
};

export function PraxisAufgabeFormFields({
    mode,
    form,
    patients,
    personal,
    canAdminStatus = false,
    canFulfillStatus = false,
    onChange,
}: Props) {
    const t = useT();
    const typOptions = PRAXIS_AUFGABE_TYPS.map((row) => ({
        value: row.value,
        label: t(`praxis.aufgaben.typ.${row.value.toLowerCase()}`),
    }));
    const statusOptions =
        mode === "edit"
            ? selectableAufgabeStatuses({
                  current: form.status,
                  canAdminStatus,
                  canFulfillStatus,
              }).map((s) => ({
                  value: s.value,
                  label: t(`praxis.aufgaben.status.${s.value.toLowerCase()}`),
              }))
            : [];

    return (
        <div className="praxis-aufgabe-form-fields">
            {mode === "create" ? (
                <Select
                    id="aufgabe-patient"
                    label={t("common.patient")}
                    value={form.patientId}
                    onChange={(e) => onChange({ patientId: e.target.value })}
                    options={[
                        { value: AUFGABE_NO_PATIENT_VALUE, label: t("praxis.aufgaben.form.no_patient") },
                        ...patients.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                />
            ) : null}
            <Input
                id="aufgabe-titel"
                label={t("common.title_field")}
                value={form.titel}
                onChange={(e) => onChange({ titel: e.target.value })}
            />
            <Textarea
                id="aufgabe-body"
                label={t("common.description")}
                rows={4}
                value={form.body}
                onChange={(e) => onChange({ body: e.target.value })}
            />
            <div className="praxis-aufgabe-form-fields__row">
                <Select
                    id="aufgabe-typ"
                    label={t("common.type")}
                    value={form.typ}
                    onChange={(e) => onChange({ typ: e.target.value as PraxisAufgabeTyp })}
                    options={typOptions}
                />
                {mode === "edit" && statusOptions.length > 1 ? (
                    <Select
                        id="aufgabe-status"
                        label={t("common.status")}
                        value={form.status}
                        onChange={(e) => onChange({ status: e.target.value as PraxisAufgabeStatus })}
                        options={statusOptions}
                    />
                ) : null}
            </div>
            <div className="praxis-aufgabe-form-fields__row">
                <Select
                    id="aufgabe-assignee-mode"
                    label={t("praxis.aufgaben.form.assignee")}
                    value={form.assigneeMode}
                    onChange={(e) =>
                        onChange({ assigneeMode: e.target.value as PraxisAufgabeTaskForm["assigneeMode"] })
                    }
                    options={[
                        { value: "rezeption", label: t("praxis.aufgaben.form.assignee_pool") },
                        { value: "user", label: t("praxis.aufgaben.form.assignee_user") },
                    ]}
                />
                {form.assigneeMode === "user" ? (
                    <Select
                        id="aufgabe-assignee-user"
                        label={t("common.person")}
                        value={form.assigneeUserId}
                        onChange={(e) => onChange({ assigneeUserId: e.target.value })}
                        options={[
                            { value: "", label: t("praxis.aufgaben.form.pick_person") },
                            ...personal.map((m) => {
                                const roleKey = `enum.rolle.${m.rolle.toLowerCase()}`;
                                const roleLabel = t(roleKey);
                                const role = roleLabel === roleKey ? m.rolle : roleLabel;
                                return { value: m.id, label: `${m.name} (${role})` };
                            }),
                        ]}
                    />
                ) : null}
            </div>
        </div>
    );
}
