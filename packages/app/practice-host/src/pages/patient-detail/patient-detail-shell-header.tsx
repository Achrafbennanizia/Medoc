import type { ChartCompletenessGap } from "@/lib/chart-completeness";
import { CalendarIcon, EditIcon, ExportIcon, ICON_SIZE_MD, MailIcon, PhoneIcon, PinIcon, ShieldCheckIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";
import { emptyPlanNextAppointment, planNextHasContent, type PlanNextAppointmentV2 } from "@/lib/plan-next-appointment";
import { alterAusDateOfBirth } from "@/lib/patient-detail-utils";
import type { PatientDetailChartTab } from "@/lib/patient-detail-utils";
import type { ValidationRecord } from "@/lib/chart-validation";
import type { PatientStatus, Patient, PatientChart, DentalFinding, Treatment, Examination, Payment, Role } from "@/models/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DentalMiniBar } from "@/views/components/DentalMiniBar";
import { PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED } from "@/lib/v1-ui-flags";
import { ChartEditFormOrInline, ConfirmOrInline } from "@/views/components/chart-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { useT, useTParams } from "@/lib/i18n";

export type PatientMasterEditForm = {
    name: string;
    phone: string;
    email: string;
    address: string;
};

export type PatientDetailShellHeaderProps = {
    patient: Patient;
    validationPendingTotal: number;
    completenessGaps: ChartCompletenessGap[];
    validationMaster: ValidationRecord | undefined;
    canWriteMedical: boolean;
    showPlanTip: boolean;
    planNext: PlanNextAppointmentV2;
    canViewClinical: boolean;
    role: Role | null;
    patientId: string;
    chart: PatientChart | null;
    findings: DentalFinding[];
    treatments: Treatment[];
    examinations: Examination[];
    payments: Payment[];
    patientDeleteOpen: boolean;
    patientDeleteBusy: boolean;
    showEditPatient: boolean;
    editForm: PatientMasterEditForm;
    onEditFormChange: (patch: Partial<PatientMasterEditForm>) => void;
    onOpenEdit: () => void;
    onOpenDelete: () => void;
    onCloseDelete: () => void;
    onConfirmDelete: () => void | Promise<void>;
    onCloseEdit: () => void;
    onSavePatient: () => void | Promise<void>;
    onValidateMaster: () => void | Promise<void>;
    onRevokeMasterValidation: () => void | Promise<void>;
    onNavigateBack: () => void;
    onTogglePlanTip: () => void;
    onPersistPlanNext: (next: PlanNextAppointmentV2) => void;
    onOpenExport: () => void;
    onOpenTicket: () => void;
    onOpenTask: () => void;
    onOpenForward: () => void;
    onOpenDischargeLeaflet: () => void;
    onOpenAppointment: () => void;
    onGoTab: (tab: PatientDetailChartTab) => void;
};

function patientStatusLabel(status: PatientStatus, tr: (key: string) => string): string {
    switch (status) {
        case "NEW":
            return tr("enum.patient_status.new");
        case "ACTIVE":
            return tr("enum.patient_status.active");
        case "VALIDATED":
            return tr("enum.patient_status.validated");
        case "READONLY":
            return tr("enum.patient_status.readonly");
        default:
            return status;
    }
}

export function PatientDetailShellHeader({
    patient,
    validationPendingTotal,
    completenessGaps,
    validationMaster,
    canWriteMedical,
    showPlanTip,
    planNext,
    canViewClinical,
    role,
    patientId,
    chart,
    findings,
    treatments,
    examinations,
    payments,
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
    onValidateMaster,
    onRevokeMasterValidation,
    onNavigateBack,
    onTogglePlanTip,
    onPersistPlanNext,
    onOpenExport,
    onOpenTicket,
    onOpenTask,
    onOpenForward,
    onOpenDischargeLeaflet,
    onOpenAppointment,
    onGoTab,
}: PatientDetailShellHeaderProps) {
    const t = useT();
    const tp = useTParams();

    return (
        <>
            <WorkspacePageHeader
                titleLevel="h1"
                title={
                    <>
                        {tp("patient.detail.header.title", { name: patient.name })}
                        {canViewClinical && validationPendingTotal > 0 ? (
                            <span
                                className="tab-badge warn"
                                style={{ marginLeft: 10, verticalAlign: "middle" }}
                                title={tp(
                                    validationPendingTotal === 1
                                        ? "patient.detail.header.validation_pending_title_one"
                                        : "patient.detail.header.validation_pending_title_many",
                                    { count: validationPendingTotal },
                                )}
                            >
                                {validationPendingTotal}
                            </span>
                        ) : null}
                        {canViewClinical && completenessGaps.length > 0 ? (
                            <span
                                className="tab-badge muted"
                                style={{ marginLeft: 8, verticalAlign: "middle" }}
                                title={tp(
                                    completenessGaps.length === 1
                                        ? "patient.detail.header.completeness_gap_title_one"
                                        : "patient.detail.header.completeness_gap_title_many",
                                    { count: completenessGaps.length },
                                )}
                            >
                                {tp("patient.detail.header.completeness_open", { count: completenessGaps.length })}
                            </span>
                        ) : null}
                    </>
                }
                back={{ onClick: onNavigateBack, label: t("patient.detail.back") }}
                actions={
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={onTogglePlanTip}
                        title={t("patient.detail.header.plan_next_title")}
                        aria-pressed={showPlanTip}
                        style={
                            planNextHasContent(planNext)
                                ? { borderColor: "var(--accent)", color: "var(--accent-ink)", background: "var(--accent-soft)" }
                                : undefined
                        }
                    >
                        <CalendarIcon size={ICON_SIZE_MD} />
                        {t("patient.detail.header.plan_next_button")}
                        {planNextHasContent(planNext) ? (
                            <span
                                aria-hidden
                                title={t("patient.detail.header.plan_next_has_content")}
                                style={{
                                    display: "inline-block",
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "var(--accent)",
                                    marginLeft: 6,
                                    verticalAlign: "middle",
                                }}
                            />
                        ) : null}
                    </button>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={onOpenExport}
                        disabled={!patientId}
                        title={t("patient.detail.header.export_title")}
                    >
                        <ExportIcon size={ICON_SIZE_MD} />
                        {t("patient.detail.header.export_button")}
                    </button>
                    {role === "RECEPTION" ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenTicket}
                            title={t("patient.detail.header.ticket_doctor_title")}
                        >
                            {t("patient.detail.header.ticket_doctor_button")}
                        </button>
                    ) : null}
                    {/* MVP blind — Task to reception / Request review / Discharge sheet (`PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED`) */}
                    {PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED && role === "PHYSICIAN" ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenTask}
                            title={t("patient.detail.header.task_reception_title")}
                        >
                            {t("patient.detail.header.task_reception_button")}
                        </button>
                    ) : null}
                    {PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED && (role === "PHYSICIAN" || role === "RECEPTION") ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenForward}
                            title={t("patient.detail.header.review_request_title")}
                        >
                            {t("patient.detail.header.review_request_button")}
                        </button>
                    ) : null}
                    {PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED && canViewClinical ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenDischargeLeaflet}
                            disabled={!patientId}
                            title={t("patient.detail.header.discharge_title")}
                        >
                            {t("patient.detail.header.discharge_button")}
                        </button>
                    ) : null}
                    <button type="button" className="btn btn-accent" onClick={onOpenAppointment}>
                        <CalendarIcon size={ICON_SIZE_MD} />
                        {t("patient.detail.header.appointment_button")}
                    </button>
                </div>
                }
            />
            {canViewClinical && completenessGaps.length > 0 ? (
                <DismissibleNotice
                    variant="warning"
                    role="region"
                    ariaLabel={t("patient.detail.header.completeness.aria")}
                    title={t("patient.detail.header.completeness.title")}
                    subtitle={t("patient.detail.header.completeness.subtitle")}
                    dismissKey={`chart-gaps-${patientId}-${completenessGaps.map((g) => g.id).sort().join("-")}`}
                    actions={
                        <>
                            {completenessGaps.map((g) =>
                                g.tab ? (
                                    <button
                                        key={g.id}
                                        type="button"
                                        className="btn btn-subtle btn-sm"
                                        onClick={() => onGoTab(g.tab as PatientDetailChartTab)}
                                    >
                                        {g.label}
                                    </button>
                                ) : (
                                    <span key={g.id} className="btn btn-subtle btn-sm" style={{ cursor: "default", opacity: 0.85 }}>
                                        {g.label}
                                    </span>
                                ),
                            )}
                        </>
                    }
                />
            ) : null}
            {showPlanTip ? (
                <PlanNextTipCard planNext={planNext} canViewClinical={canViewClinical} onPersistPlanNext={onPersistPlanNext} onClose={onTogglePlanTip} />
            ) : null}
            <div className="card patient-hero-card">
                <div className="patient-hero-top">
                    <div className="patient-hero-identity">
                        <div className="av av-lg av--accent" aria-hidden>
                            {patient.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                        </div>
                        <div className="patient-hero-identity-text">
                            <h2 className="patient-hero-name">{patient.name}</h2>
                            <div className="patient-hero-badges">
                                {patient.status === "NEW" ? (
                                    <span title={t("patient.status.new.explanation")}>
                                        <Badge variant="primary">{patientStatusLabel(patient.status, t)}</Badge>
                                    </span>
                                ) : (
                                    <Badge variant="primary">{patientStatusLabel(patient.status, t)}</Badge>
                                )}
                                {payments.some(
                                    (z) =>
                                        z.patient_id === patient.id && (z.status === "OUTSTANDING" || z.status === "PARTIALLY_PAID"),
                                ) ? (
                                    <Badge variant="warning">{t("patient.detail.header.badge.invoice_open")}</Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {canViewClinical && chart ? (
                        <div className="patient-hero-dental">
                            <DentalMiniBar
                                findings={findings}
                                treatments={treatments}
                                examinations={examinations}
                                visible
                            />
                        </div>
                    ) : null}
                </div>
                <div className="patient-hero-contacts">
                    <span className="patient-hero-contact" title={t("patient.detail.header.contact.birthday")}>
                        <CalendarIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">
                            {formatDate(patient.date_of_birth)}
                            {(() => {
                                const alter = alterAusDateOfBirth(patient.date_of_birth);
                                return alter != null ? (
                                    <>
                                        <span className="patient-hero-contact__sep"> · </span>
                                        <strong className="patient-hero-contact__age">{tp("patient.detail.header.age_suffix", { age: alter })}</strong>
                                    </>
                                ) : null;
                            })()}
                        </span>
                    </span>
                    <span className="patient-hero-contact" title={t("common.phone")}>
                        <PhoneIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">{patient.phone || "—"}</span>
                    </span>
                    <span className="patient-hero-contact" title={t("patient.detail.header.contact.email_insurance")}>
                        <MailIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">
                            {patient.email || "—"}
                            {patient.insurance_number ? (
                                <>
                                    <span className="patient-hero-contact__sep"> · </span>
                                    {t("patient.detail.header.insurance_prefix")} {patient.insurance_number}
                                </>
                            ) : null}
                        </span>
                    </span>
                    <span className="patient-hero-contact" title={t("patient.detail.header.contact.gender")}>
                        <span className="patient-hero-contact__text">{patient.sex || "—"}</span>
                    </span>
                    <span className="patient-hero-contact" title={t("patient.detail.header.contact.address")}>
                        <PinIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">{patient.address || "—"}</span>
                    </span>
                </div>
                <div className="patient-hero-actions">
                    <div className="patient-hero-actions__hint">
                        {validationMaster ? (
                            <span className="card-sub">
                                {tp("patient.detail.header.master_validated", {
                                    datetime: formatDateTime(validationMaster.validatedAt),
                                })}
                            </span>
                        ) : canViewClinical ? (
                            <span className="card-sub">{t("patient.detail.header.master_pending")}</span>
                        ) : null}
                    </div>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button size="sm" variant="secondary" onClick={onOpenEdit}>
                            <EditIcon size={ICON_SIZE_MD} />
                            {t("common.edit")}
                        </Button>
                        {canViewClinical ? (
                            validationMaster ? (
                                <Button size="sm" variant="ghost" onClick={() => void onRevokeMasterValidation()}>
                                    {t("patient.detail.header.revoke_validation")}
                                </Button>
                            ) : (
                                <Button size="sm" variant="primary" onClick={() => void onValidateMaster()}>
                                    <ShieldCheckIcon size={ICON_SIZE_MD} />
                                    {t("patient.detail.header.validate")}
                                </Button>
                            )
                        ) : null}
                        {canWriteMedical ? (
                            <Button size="sm" variant="danger" onClick={onOpenDelete}>
                                {t("patient.detail.header.delete_chart")}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
            {patientDeleteOpen && canWriteMedical ? (
                <ConfirmOrInline
                    area="patient_chart_patient_delete"
                    open={patientDeleteOpen && canWriteMedical}
                    inlineId="ak-patient-delete-panel"
                    title={t("patient.detail.header.delete_confirm.title")}
                    message={t("patient.detail.header.delete_confirm.message")}
                    onCancel={() => !patientDeleteBusy && onCloseDelete()}
                    onConfirm={() => void onConfirmDelete()}
                    confirmLabel={t("patient.detail.header.delete_confirm.confirm")}
                    danger
                    loading={patientDeleteBusy}
                />
            ) : null}
            {showEditPatient ? (
                <ChartEditFormOrInline
                    area="patient_chart_patient_edit"
                    open={showEditPatient}
                    onClose={onCloseEdit}
                    title={t("patient.detail.header.edit.title")}
                    subtitle={t("patient.detail.header.edit.subtitle")}
                    inlineId="ak-patient-edit-panel"
                    ariaLabel={t("patient.detail.header.edit.aria")}
                    footer={(
                        <>
                            <Button type="button" variant="ghost" onClick={onCloseEdit}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={() => void onSavePatient()} disabled={!editForm.name.trim()}>
                                {t("common.save")}
                            </Button>
                        </>
                    )}
                >
                    <Input
                        id="ed-name"
                        label={t("common.name")}
                        value={editForm.name}
                        onChange={(e) => onEditFormChange({ name: e.target.value })}
                    />
                    <Input
                        id="ed-tel"
                        label={t("common.phone")}
                        value={editForm.phone}
                        onChange={(e) => onEditFormChange({ phone: e.target.value })}
                    />
                    <Input
                        id="ed-mail"
                        label={t("common.email")}
                        value={editForm.email}
                        onChange={(e) => onEditFormChange({ email: e.target.value })}
                    />
                    <Textarea
                        id="ed-addr"
                        label={t("patient.detail.header.contact.address")}
                        value={editForm.address}
                        onChange={(e) => onEditFormChange({ address: e.target.value })}
                    />
                </ChartEditFormOrInline>
            ) : null}
        </>
    );
}

function PlanNextTipCard({
    planNext,
    canViewClinical,
    onPersistPlanNext,
    onClose,
}: {
    planNext: PlanNextAppointmentV2;
    canViewClinical: boolean;
    onPersistPlanNext: (next: PlanNextAppointmentV2) => void;
    onClose: () => void;
}) {
    const t = useT();

    return (
        <DismissibleNotice
            variant="accent"
            role="region"
            ariaLabel={t("patient.detail.plan_next.aria")}
            title={t("patient.detail.plan_next.title")}
            subtitle={t("patient.detail.plan_next.subtitle")}
            onDismiss={onClose}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                    id="plan-urgency"
                    label={t("patient.detail.plan_next.urgency")}
                    value={planNext.urgency}
                    onChange={(e) => onPersistPlanNext({ ...planNext, urgency: e.target.value as PlanNextAppointmentV2["urgency"] })}
                    options={[
                        { value: "routine", label: t("patient.detail.plan_next.urgency.routine") },
                        { value: "bald", label: t("patient.detail.plan_next.urgency.soon") },
                        { value: "dringend", label: t("patient.detail.plan_next.urgency.urgent") },
                    ]}
                />
                <Select
                    id="plan-kind"
                    label={t("patient.detail.plan_next.kind_hint")}
                    value={planNext.appointmentKindHint}
                    onChange={(e) => onPersistPlanNext({ ...planNext, appointmentKindHint: e.target.value })}
                    options={[
                        { value: "", label: t("patient.detail.plan_next.kind_open") },
                        { value: "CHECKUP", label: t("appointment.kind.CHECKUP") },
                        { value: "TREATMENT", label: t("appointment.kind.TREATMENT") },
                        { value: "EXAMINATION", label: t("appointment.kind.EXAMINATION") },
                        { value: "CONSULTATION", label: t("appointment.kind.CONSULTATION") },
                        { value: "FIRST_VISIT", label: t("appointment.kind.FIRST_VISIT") },
                    ]}
                />
                <Input
                    id="plan-dur"
                    type="number"
                    min={5}
                    step={5}
                    label={t("patient.detail.plan_next.duration")}
                    value={planNext.durationMin}
                    onChange={(e) => onPersistPlanNext({ ...planNext, durationMin: e.target.value })}
                    placeholder={t("patient.detail.plan_next.duration_ph")}
                />
            </div>
            <Input
                id="patient-plan-freetext"
                label={t("patient.detail.plan_next.freetext")}
                value={planNext.freeText}
                onChange={(e) => onPersistPlanNext({ ...planNext, freeText: e.target.value.slice(0, 140) })}
                placeholder={t("patient.detail.plan_next.freetext_ph")}
                style={{ marginTop: 12 }}
            />
            <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--fg-2)" }}>
                    {t("patient.detail.plan_next.more_details")}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: 12 }}>
                    <Select
                        id="plan-interval"
                        label={t("patient.detail.plan_next.interval")}
                        value={planNext.intervalWeeks}
                        onChange={(e) => onPersistPlanNext({ ...planNext, intervalWeeks: e.target.value })}
                        options={[
                            { value: "", label: t("patient.detail.plan_next.interval.empty") },
                            { value: "2", label: t("patient.detail.plan_next.interval.2w") },
                            { value: "4", label: t("patient.detail.plan_next.interval.4w") },
                            { value: "6", label: t("patient.detail.plan_next.interval.6w") },
                            { value: "12", label: t("patient.detail.plan_next.interval.12w") },
                            { value: "26", label: t("patient.detail.plan_next.interval.26w") },
                        ]}
                    />
                    <Input
                        id="plan-days"
                        label={t("patient.detail.plan_next.weekdays")}
                        value={planNext.preferredWeekdays}
                        onChange={(e) => onPersistPlanNext({ ...planNext, preferredWeekdays: e.target.value })}
                        placeholder={t("patient.detail.plan_next.weekdays_ph")}
                    />
                </div>
                {canViewClinical ? (
                    <Textarea
                        id="patient-plan-internal"
                        label={t("patient.detail.plan_next.internal")}
                        rows={2}
                        value={planNext.internalNote}
                        onChange={(e) => onPersistPlanNext({ ...planNext, internalNote: e.target.value })}
                        placeholder={t("patient.detail.plan_next.internal_ph")}
                        style={{ marginTop: 12 }}
                    />
                ) : null}
            </details>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                {planNextHasContent(planNext) ? (
                    <Button size="sm" variant="ghost" onClick={() => onPersistPlanNext(emptyPlanNextAppointment())}>
                        {t("patient.detail.plan_next.clear")}
                    </Button>
                ) : null}
            </div>
        </DismissibleNotice>
    );
}
