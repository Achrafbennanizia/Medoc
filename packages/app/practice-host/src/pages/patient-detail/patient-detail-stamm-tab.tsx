import { formatDate, formatDateTime } from "@/lib/utils";
import type { ValidationRecord } from "@/lib/akte-validation";
import type { Patient } from "@/models/types";
import { EditIcon, ShieldCheckIcon } from "@/lib/icons";
import { AkteEditFormOrInline, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { Input, Textarea } from "@/views/components/ui/input";

export type PatientStammEditForm = {
    name: string;
    telefon: string;
    email: string;
    adresse: string;
};

export type PatientDetailStammTabProps = {
    patient: Patient;
    validationStamm: ValidationRecord | undefined;
    canViewClinical: boolean;
    canWriteMedical: boolean;
    patientDeleteOpen: boolean;
    patientDeleteBusy: boolean;
    showEditPatient: boolean;
    editForm: PatientStammEditForm;
    onEditFormChange: (patch: Partial<PatientStammEditForm>) => void;
    onOpenEdit: () => void;
    onOpenDelete: () => void;
    onCloseDelete: () => void;
    onConfirmDelete: () => void | Promise<void>;
    onCloseEdit: () => void;
    onSavePatient: () => void | Promise<void>;
    onValidateStamm: () => void | Promise<void>;
    onRevokeStammValidation: () => void | Promise<void>;
};

export function PatientDetailStammTab({
    patient,
    validationStamm,
    canViewClinical,
    canWriteMedical,
    patientDeleteOpen,
    patientDeleteBusy,
    showEditPatient,
    editForm,
    onEditFormChange,
    onOpenEdit,
    onOpenDelete,
    onCloseDelete,
    onConfirmDelete,
    onCloseEdit,
    onSavePatient,
    onValidateStamm,
    onRevokeStammValidation,
}: PatientDetailStammTabProps) {
    return (
        <div id="panel-stamm" role="tabpanel" aria-labelledby="tab-stamm">
            <div className="col" style={{ gap: 16 }}>
                <Card className="card-pad">
                    <CardHeader
                        title="Stammdaten"
                        subtitle={
                            validationStamm
                                ? `Stammdaten & Anamnese geprüft · ${formatDateTime(validationStamm.validatedAt)}`
                                : canViewClinical
                                  ? "Vom Empfang erfasst — mit „Validieren“ Stammdaten und Anamnese zusammen bestätigen"
                                  : "Stammdaten des Patienten"
                        }
                        action={(
                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                <Button size="sm" variant="secondary" onClick={onOpenEdit}>
                                    <EditIcon />
                                    Bearbeiten
                                </Button>
                                {canViewClinical ? (
                                    validationStamm ? (
                                        <Button size="sm" variant="ghost" onClick={() => void onRevokeStammValidation()}>
                                            Validierung zurückziehen
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="primary" onClick={() => void onValidateStamm()}>
                                            <ShieldCheckIcon />
                                            Validieren
                                        </Button>
                                    )
                                ) : null}
                                {canWriteMedical ? (
                                    <Button size="sm" variant="danger" onClick={onOpenDelete}>
                                        Akte löschen
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    />
                    <dl style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                            ["Geburtsdatum", formatDate(patient.geburtsdatum)],
                            ["Geschlecht", patient.geschlecht],
                            ["Versicherungs-Nr.", patient.versicherungsnummer],
                            ["Telefon", patient.telefon || "–"],
                            ["E-Mail", patient.email || "–"],
                            ["Adresse", patient.adresse || "–"],
                        ].map(([label, value]) => (
                            <div key={label} className="row" style={{ justifyContent: "space-between" }}>
                                <dt style={{ color: "var(--fg-3)" }}>{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </Card>
                {patientDeleteOpen && canWriteMedical ? (
                    <ConfirmOrInline
                        area="patient_akte_patient_delete"
                        open={patientDeleteOpen && canWriteMedical}
                        inlineId="ak-patient-delete-panel"
                        title="Löschen bestätigen"
                        message="Möchten Sie diese Patientenakte wirklich löschen? Die Akte und verknüpfte klinische Einträge werden entfernt, sofern das Backend dies zulässt."
                        onCancel={() => !patientDeleteBusy && onCloseDelete()}
                        onConfirm={() => void onConfirmDelete()}
                        confirmLabel="Ja, löschen"
                        danger
                        loading={patientDeleteBusy}
                    />
                ) : null}
                {showEditPatient ? (
                    <AkteEditFormOrInline
                        area="patient_akte_patient_edit"
                        open={showEditPatient}
                        onClose={onCloseEdit}
                        title="Patient bearbeiten"
                        subtitle="Änderungen gelten für die Stammdaten dieses Patienten."
                        inlineId="ak-patient-edit-panel"
                        ariaLabel="Patient bearbeiten"
                        footer={(
                            <>
                                <Button type="button" variant="ghost" onClick={onCloseEdit}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void onSavePatient()}
                                    disabled={!editForm.name.trim()}
                                >
                                    Speichern
                                </Button>
                            </>
                        )}
                    >
                        <Input
                            id="ed-name"
                            label="Name"
                            value={editForm.name}
                            onChange={(e) => onEditFormChange({ name: e.target.value })}
                        />
                        <Input
                            id="ed-tel"
                            label="Telefon"
                            value={editForm.telefon}
                            onChange={(e) => onEditFormChange({ telefon: e.target.value })}
                        />
                        <Input
                            id="ed-mail"
                            label="E-Mail"
                            value={editForm.email}
                            onChange={(e) => onEditFormChange({ email: e.target.value })}
                        />
                        <Textarea
                            id="ed-addr"
                            label="Adresse"
                            value={editForm.adresse}
                            onChange={(e) => onEditFormChange({ adresse: e.target.value })}
                        />
                    </AkteEditFormOrInline>
                ) : null}
            </div>
        </div>
    );
}
