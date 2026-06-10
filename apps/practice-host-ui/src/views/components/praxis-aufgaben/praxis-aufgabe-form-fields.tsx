import type { Patient, Personal } from "@/models/types";
import type { PraxisAufgabeStatus, PraxisAufgabeTyp } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { Input, Select, Textarea } from "../ui/input";
import {
    AUFGABE_NO_PATIENT_LABEL,
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
    const statusOptions =
        mode === "edit"
            ? selectableAufgabeStatuses({
                  current: form.status,
                  canAdminStatus,
                  canFulfillStatus,
              })
            : [];

    return (
        <div className="praxis-aufgabe-form-fields">
            {mode === "create" ? (
                <Select
                    id="aufgabe-patient"
                    label="Patient"
                    value={form.patientId}
                    onChange={(e) => onChange({ patientId: e.target.value })}
                    options={[
                        { value: AUFGABE_NO_PATIENT_VALUE, label: AUFGABE_NO_PATIENT_LABEL },
                        ...patients.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                />
            ) : null}
            <Input
                id="aufgabe-titel"
                label="Titel"
                value={form.titel}
                onChange={(e) => onChange({ titel: e.target.value })}
            />
            <Textarea
                id="aufgabe-body"
                label="Beschreibung"
                rows={4}
                value={form.body}
                onChange={(e) => onChange({ body: e.target.value })}
            />
            <div className="praxis-aufgabe-form-fields__row">
                <Select
                    id="aufgabe-typ"
                    label="Typ"
                    value={form.typ}
                    onChange={(e) => onChange({ typ: e.target.value as PraxisAufgabeTyp })}
                    options={PRAXIS_AUFGABE_TYPS.map((t) => ({ value: t.value, label: t.label }))}
                />
                {mode === "edit" && statusOptions.length > 1 ? (
                    <Select
                        id="aufgabe-status"
                        label="Status"
                        value={form.status}
                        onChange={(e) => onChange({ status: e.target.value as PraxisAufgabeStatus })}
                        options={statusOptions.map((s) => ({ value: s.value, label: s.label }))}
                    />
                ) : null}
            </div>
            <div className="praxis-aufgabe-form-fields__row">
                <Select
                    id="aufgabe-assignee-mode"
                    label="Zugewiesen an"
                    value={form.assigneeMode}
                    onChange={(e) =>
                        onChange({ assigneeMode: e.target.value as PraxisAufgabeTaskForm["assigneeMode"] })
                    }
                    options={[
                        { value: "rezeption", label: "Rezeption (Pool)" },
                        { value: "user", label: "Bestimmte Person" },
                    ]}
                />
                {form.assigneeMode === "user" ? (
                    <Select
                        id="aufgabe-assignee-user"
                        label="Person"
                        value={form.assigneeUserId}
                        onChange={(e) => onChange({ assigneeUserId: e.target.value })}
                        options={[
                            { value: "", label: "Person wählen…" },
                            ...personal.map((m) => ({
                                value: m.id,
                                label: `${m.name} (${m.rolle})`,
                            })),
                        ]}
                    />
                ) : null}
            </div>
        </div>
    );
}
