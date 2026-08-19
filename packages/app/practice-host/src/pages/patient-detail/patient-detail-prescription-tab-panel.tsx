import { Fragment } from "react";
import type { usePatientDetailPrescriptionTab } from "./use-patient-detail-prescription-tab";
import {
    certificateGueltigUntilFromFromAndTage,
    certificateKindSelectOptions,
    illnessSuggestionLabels,
} from "@/lib/certificate-composer";
import { MEDICATION_SUGGESTIONS } from "@/lib/medications";
import { formatDate } from "@/lib/utils";
import { PlusIcon } from "@/lib/icons";
import { prescriptionStatusDisplay } from "@/lib/patient-detail-utils";
import { ChartEditFormOrInline, ConfirmOrInline } from "@/views/components/chart-confirm-presentation";
import { PaymentRowActionsMenu, type PaymentRowAction } from "@/views/components/payment-row-actions-menu";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { EmptyState } from "@/views/components/ui/empty-state";
import { FormSection } from "@/views/components/ui/form-section";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { useT, useTParams } from "@/lib/i18n";

export type PatientDetailPrescriptionTabPanelProps = Omit<
    ReturnType<typeof usePatientDetailPrescriptionTab>,
    "flushChartSaveConfirm"
>;

export function PatientDetailPrescriptionTabPanel(props: PatientDetailPrescriptionTabPanelProps) {
    const {
        id,
        canWriteMedical,
        prescriptionCertificateSub,
        setPrescriptionCertificateSub,
        resetPrescriptionWizard,
        resetCertificateWizard,
        prescriptions,
        certificates,
        prescriptionDeleteId,
        setPrescriptionDeleteId,
        certificateDeleteId,
        setCertificateDeleteId,
        openPrescriptionPick,
        openPrescriptionNew,
        openCertificatePick,
        openCertificateNew,
        proceedPrescriptionPick,
        proceedCertificatePick,
        handleDeletePrescription,
        handleDeleteCertificate,
        handlePrintPrescription,
        handlePrintCertificate,
        runSavePrescriptionEdit,
        prescriptionEdit,
        setPrescriptionEdit,
        prescriptionEditUnlocked,
        setPrescriptionEditUnlocked,
        prescriptionEditForm,
        setPrescriptionEditForm,
        prescriptionWizardStep,
        prescriptionWizardPanelRef,
        prescriptionComposerKind,
        prescriptionLines,
        prescriptionDraft,
        setPrescriptionDraft,
        prescriptionSharedNotes,
        setPrescriptionSharedNotes,
        prescriptionDraftErr,
        prescriptionComposerBusy,
        prescriptionPickQuery,
        setPrescriptionPickQuery,
        setPrescriptionPickSelectedId,
        prescriptionNewTemplateTitle,
        setPrescriptionNewTemplateTitle,
        prescriptionTemplates,
        prescriptionPickFiltered,
        prescriptionListeGeaendert,
        submitPrescriptionComposer,
        onPrescriptionAskTemplateNo,
        onPrescriptionAskTemplateYes,
        onPrescriptionNameTemplateSkip,
        onPrescriptionNameTemplateSave,
        patchPrescriptionLine,
        pickMedForPrescriptionDraft,
        addPrescriptionDraftLine,
        setPrescriptionLines,
        certificateWizardStep,
        certificateWizardPanelRef,
        certificateComposerKind,
        certificateForm,
        setCertificateForm,
        certificateDraftErr,
        certificateComposerBusy,
        certificatePickQuery,
        setCertificatePickQuery,
        setCertificatePickSelectedId,
        certificateNewTemplateTitle,
        setCertificateNewTemplateTitle,
        certificateTemplates,
        certificatePickFiltered,
        certificateListeGeaendert,
        submitCertificateComposer,
        onCertificateAskTemplateNo,
        onCertificateAskTemplateYes,
        onCertificateNameTemplateSkip,
        onCertificateNameTemplateSave,
    } = props;

    const t = useT();
    const tp = useTParams();

    return (
    <div id="panel-prescription" role="tabpanel" aria-labelledby="tab-prescription">
    <Card className="card-pad card--overflow-visible">
        <div className="chart-payment-modus" role="tablist" aria-label={t("page.patient_detail.prescription.view_aria")} style={{ marginBottom: 16 }}>
            <button
                type="button"
                role="tab"
                aria-selected={prescriptionCertificateSub === "prescription"}
                className={`chart-payment-modus__btn${prescriptionCertificateSub === "prescription" ? " is-active" : ""}`}
                onClick={() => {
                    setPrescriptionCertificateSub("prescription");
                    resetCertificateWizard();
                    setCertificateDeleteId(null);
                }}
            >
                {t("page.patient_detail.prescription.tab_prescription")}
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={prescriptionCertificateSub === "certificate"}
                className={`chart-payment-modus__btn${prescriptionCertificateSub === "certificate" ? " is-active" : ""}`}
                onClick={() => {
                    setPrescriptionCertificateSub("certificate");
                    resetPrescriptionWizard();
                    setPrescriptionEdit(null);
                    setPrescriptionDeleteId(null);
                }}
            >
                {t("nav.certificates")}
            </button>
        </div>
        {prescriptionCertificateSub === "prescription" ? (
        <>
        <CardHeader
            title={t("page.patient_detail.prescription.title")}
            subtitle={t("page.patient_detail.prescription.subtitle")}
            action={canWriteMedical ? (
                <>
                    <Button type="button" size="sm" variant="secondary" onClick={openPrescriptionPick} disabled={!id}>
                        {t("page.patient_detail.prescription.predefined_btn")}
                    </Button>
                    <Button type="button" size="sm" onClick={openPrescriptionNew} disabled={!id}>
                        <PlusIcon /> {t("page.patient_detail.prescription.new_btn")}
                    </Button>
                </>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                {t("page.patient_detail.prescription.readonly_hint")}
            </p>
        ) : null}

            {canWriteMedical && prescriptionWizardStep ? (
                <div
                    ref={prescriptionWizardPanelRef}
                    id="ak-prescription-wizard-panel"
                    className="prescription-chart-panel"
                    role="region"
                    aria-label={t("page.patient_detail.prescription.wizard_aria")}
                >
                    <div className="prescription-chart-panel-head">
                        <div>
                            <div className="prescription-chart-panel-title">
                                {prescriptionWizardStep === "pick" ? t("page.patient_detail.prescription.wizard_pick_title") : null}
                                {prescriptionWizardStep === "compose"
                                    ? (prescriptionComposerKind === "template" ? t("page.patient_detail.prescription.wizard_from_template") : t("page.patient_detail.prescription.wizard_new"))
                                    : null}
                                {prescriptionWizardStep === "ask_template" ? t("page.patient_detail.prescription.wizard_save_template_q") : null}
                                {prescriptionWizardStep === "name_template" ? t("page.patient_detail.prescription.wizard_template_name") : null}
                            </div>
                            {prescriptionWizardStep === "pick" ? (
                                <div className="prescription-chart-panel-sub">
                                    {t("page.patient_detail.prescription.pick_sub")}
                                </div>
                            ) : null}
                            {prescriptionWizardStep === "compose" ? (
                                <div className="prescription-chart-panel-sub">
                                    {t("page.patient_detail.prescription.compose_sub")}
                                </div>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!prescriptionComposerBusy) resetPrescriptionWizard();
                            }}
                            disabled={prescriptionComposerBusy}
                        >
                            {t("common.close")}
                        </Button>
                    </div>

                    <div className="prescription-chart-panel-body">
                        {prescriptionWizardStep === "pick" ? (
                            <>
                                <datalist id="ak-prescription-templates-dl">
                                    {prescriptionTemplates.map((version) => (
                                        <option key={version.id} value={version.title} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-rz-pick-q"
                                    label={t("common.template_search")}
                                    list="ak-prescription-templates-dl"
                                    value={prescriptionPickQuery}
                                    onChange={(e) => {
                                        setPrescriptionPickQuery(e.target.value);
                                        setPrescriptionPickSelectedId("");
                                    }}
                                    placeholder={t("common.search_title_ph")}
                                />
                                <div
                                    style={{
                                        maxHeight: 200,
                                        overflowY: "auto",
                                        marginTop: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    {prescriptionPickFiltered.length === 0 ? (
                                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                            {t("page.patient_detail.prescription.no_results")}
                                        </span>
                                    ) : (
                                        prescriptionPickFiltered.slice(0, 24).map((version) => (
                                            <button
                                                key={version.id}
                                                type="button"
                                                className="btn btn-subtle btn-sm"
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                onClick={() => {
                                                    setPrescriptionPickSelectedId(version.id);
                                                    setPrescriptionPickQuery(version.title);
                                                }}
                                            >
                                                {version.title}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}

                        {prescriptionWizardStep === "compose" ? (
                            <>
                                {prescriptionComposerKind === "template" && prescriptionListeGeaendert ? (
                                    <p
                                        style={{
                                            fontSize: 12.5,
                                            marginTop: 0,
                                            marginBottom: 12,
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            background: "var(--accent-soft)",
                                            color: "var(--accent-ink)",
                                        }}
                                    >
                                        {t("page.patient_detail.prescription.template_modified").split(t("page.patient_detail.prescription.template_modified_emphasis"))[0]}
                                        <strong>{t("page.patient_detail.prescription.template_modified_emphasis")}</strong>
                                        {t("page.patient_detail.prescription.template_modified").split(t("page.patient_detail.prescription.template_modified_emphasis"))[1]}
                                    </p>
                                ) : null}
                                {prescriptionLines.length > 0 ? (
                                    <div style={{ overflowX: "auto", marginBottom: 12 }}>
                                        <table className="tbl">
                                            <thead>
                                                <tr>
                                                    <th>{t("page.prescriptions.col.medication")}</th>
                                                    <th>{t("page.prescriptions.field.active_ingredient")}</th>
                                                    <th>{t("page.prescriptions.col.dosage")}</th>
                                                    <th>{t("page.prescriptions.col.duration")}</th>
                                                    <th>{t("page.patient_detail.prescription.col.notes")}</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {prescriptionLines.map((ln, i) => (
                                                    <tr key={`${i}-${ln.medication}`}>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.medication}
                                                                onChange={(e) => patchPrescriptionLine(i, { medication: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.active_ingredient}
                                                                onChange={(e) => patchPrescriptionLine(i, { active_ingredient: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.dosage}
                                                                onChange={(e) => patchPrescriptionLine(i, { dosage: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.duration}
                                                                onChange={(e) => patchPrescriptionLine(i, { duration: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.instructions}
                                                                onChange={(e) => patchPrescriptionLine(i, { instructions: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setPrescriptionLines((prev) => prev.filter((_, j) => j !== i))}
                                                            >
                                                                {t("common.remove")}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : null}

                                <datalist id="ak-prescription-med-dl">
                                    {MEDICATION_SUGGESTIONS.map((s) => (
                                        <option key={s.label} value={s.label} />
                                    ))}
                                </datalist>
                                <div
                                    style={{
                                        border: "1px solid var(--line)",
                                        borderRadius: 10,
                                        padding: 12,
                                        background: "rgba(0,0,0,0.02)",
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("page.patient_detail.prescription.add_line_title")}</div>
                                    {prescriptionDraftErr ? (
                                        <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{prescriptionDraftErr}</p>
                                    ) : null}
                                    <Input
                                        id="ak-rz-d-med"
                                        label={t("page.prescriptions.field.medication")}
                                        list="ak-prescription-med-dl"
                                        value={prescriptionDraft.medication}
                                        onChange={(e) => pickMedForPrescriptionDraft(e.target.value)}
                                        placeholder={t("page.prescriptions.field.medication_ph")}
                                    />
                                    <Input
                                        id="ak-rz-d-wirk"
                                        label={t("page.prescriptions.field.active_ingredient")}
                                        value={prescriptionDraft.active_ingredient}
                                        onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, active_ingredient: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            id="ak-rz-d-dos"
                                            label={t("page.prescriptions.field.dosage")}
                                            value={prescriptionDraft.dosage}
                                            onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, dosage: e.target.value })}
                                        />
                                        <Input
                                            id="ak-rz-d-duration"
                                            label={t("page.prescriptions.field.duration")}
                                            value={prescriptionDraft.duration}
                                            onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, duration: e.target.value })}
                                        />
                                    </div>
                                    <Textarea
                                        id="ak-rz-d-hin"
                                        label={t("page.prescriptions.field.notes_line")}
                                        rows={2}
                                        value={prescriptionDraft.instructions}
                                        onChange={(e) => setPrescriptionDraft({ ...prescriptionDraft, instructions: e.target.value })}
                                    />
                                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                        <Button type="button" size="sm" variant="secondary" onClick={addPrescriptionDraftLine}>
                                            {t("page.patient_detail.prescription.add_line_btn")}
                                        </Button>
                                    </div>
                                </div>

                                <Textarea
                                    id="ak-rz-shared"
                                    label={t("page.prescriptions.shared_notes")}
                                    rows={2}
                                    value={prescriptionSharedNotes}
                                    onChange={(e) => setPrescriptionSharedNotes(e.target.value)}
                                />
                            </>
                        ) : null}

                        {prescriptionWizardStep === "ask_template" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>{t("common.yes")}:</strong> {t("page.patient_detail.prescription.ask_template_yes")}
                                {" "}
                                <strong>{t("common.no")}:</strong> {t("page.patient_detail.prescription.ask_template_no")}
                            </p>
                        ) : null}

                        {prescriptionWizardStep === "name_template" ? (
                            <Input
                                id="ak-rz-template-name"
                                label={t("common.template_label")}
                                value={prescriptionNewTemplateTitle}
                                onChange={(e) => setPrescriptionNewTemplateTitle(e.target.value)}
                                placeholder={t("page.patient_detail.prescription.template_ph")}
                            />
                        ) : null}
                    </div>

                    <div className="prescription-chart-panel-actions">
                        {prescriptionWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetPrescriptionWizard()}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="button" onClick={proceedPrescriptionPick}>
                                    {t("common.next")}
                                </Button>
                            </>
                        ) : null}
                        {prescriptionWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetPrescriptionWizard()} disabled={prescriptionComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitPrescriptionComposer()}
                                    loading={prescriptionComposerBusy}
                                    disabled={prescriptionComposerBusy}
                                >
                                    {t("page.patient_detail.prescription.save_for_patient")}
                                </Button>
                            </>
                        ) : null}
                        {prescriptionWizardStep === "ask_template" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onPrescriptionAskTemplateNo}>
                                    {t("common.no")}
                                </Button>
                                <Button type="button" onClick={onPrescriptionAskTemplateYes}>
                                    {t("common.yes")}
                                </Button>
                            </>
                        ) : null}
                        {prescriptionWizardStep === "name_template" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onPrescriptionNameTemplateSkip} disabled={prescriptionComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onPrescriptionNameTemplateSave()}
                                    loading={prescriptionComposerBusy}
                                    disabled={prescriptionComposerBusy}
                                >
                                    {t("page.patient_detail.prescription.save_template_and")}
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}


        <FormSection title={t("page.patient_detail.prescription.list_section")}>
            {prescriptions.length === 0 ? (
                <EmptyState
                    icon="💊"
                    title={t("page.patient_detail.prescription.empty_title")}
                    description={canWriteMedical
                        ? t("page.patient_detail.prescription.empty_desc_write")
                        : t("page.patient_detail.prescription.empty_desc_read")}
                    action={canWriteMedical && id
                        ? { label: t("page.patient_detail.prescription.new_btn"), onClick: openPrescriptionNew }
                        : undefined}
                />
            ) : (
                <div className="prescription-certificate-table-scroll">
                    <table className="tbl tbl-prescription-chart">
                        <thead>
                            <tr>
                                <th>{t("page.prescriptions.col.medication")}</th>
                                <th>{t("page.prescriptions.col.dosage")}</th>
                                <th>{t("page.prescriptions.col.duration")}</th>
                                <th>{t("page.prescriptions.col.status")}</th>
                                <th>{t("common.issued")}</th>
                                <th className="prescription-th-actions">{t("patient.detail.tab.treatment.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prescriptions.map((r) => {
                                const st = prescriptionStatusDisplay(r.status, t);
                                const showEditRow =
                                    canWriteMedical && prescriptionEdit?.id === r.id && !prescriptionWizardStep;
                                return (
                                    <Fragment key={r.id}>
                                        {showEditRow ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    style={{
                                                        padding: 12,
                                                        verticalAlign: "top",
                                                        background: "var(--bg-elev)",
                                                    }}
                                                >
                                                    <ChartEditFormOrInline
                                                        area="patient_chart_prescription_edit"
                                                        open={canWriteMedical && !!prescriptionEdit && !prescriptionWizardStep}
                                                        onClose={() => setPrescriptionEdit(null)}
                                                        title={t("page.patient_detail.prescription.edit_title")}
                                                        subtitle={
                                                            prescriptionEditUnlocked
                                                                ? t("page.patient_detail.prescription.edit_sub_unlocked")
                                                                : t("page.patient_detail.prescription.edit_sub_locked")
                                                        }
                                                        inlineId={`ak-prescription-edit-inline-${r.id}`}
                                                        ariaLabel={t("page.patient_detail.prescription.edit_title")}
                                                        panelVariant="prescription"
                                                        headerExtra={
                                                            !prescriptionEditUnlocked ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => setPrescriptionEditUnlocked(true)}
                                                                >
                                                                    {t("common.edit")}
                                                                </Button>
                                                            ) : null
                                                        }
                                                        footer={(
                                                            <>
                                                                <Button type="button" variant="ghost" onClick={() => setPrescriptionEdit(null)}>
                                                                    {t("common.cancel")}
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => void runSavePrescriptionEdit()}
                                                                    disabled={
                                                                        !prescriptionEditUnlocked
                                                                        || !prescriptionEditForm.medication.trim()
                                                                        || !prescriptionEditForm.dosage.trim()
                                                                        || !prescriptionEditForm.duration.trim()
                                                                    }
                                                                >
                                                                    {t("common.save")}
                                                                </Button>
                                                            </>
                                                        )}
                                                    >
                                                        <Input
                                                            id={`rex-med-${r.id}`}
                                                            label={t("page.prescriptions.field.medication")}
                                                            value={prescriptionEditForm.medication}
                                                            disabled={!prescriptionEditUnlocked}
                                                            onChange={(e) =>
                                                                setPrescriptionEditForm({
                                                                    ...prescriptionEditForm,
                                                                    medication: e.target.value,
                                                                })}
                                                        />
                                                        <Input
                                                            id={`rex-wirk-${r.id}`}
                                                            label={t("page.prescriptions.field.active_ingredient")}
                                                            value={prescriptionEditForm.active_ingredient}
                                                            disabled={!prescriptionEditUnlocked}
                                                            onChange={(e) =>
                                                                setPrescriptionEditForm({
                                                                    ...prescriptionEditForm,
                                                                    active_ingredient: e.target.value,
                                                                })}
                                                        />
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <Input
                                                                id={`rex-dos-${r.id}`}
                                                                label={t("page.prescriptions.field.dosage")}
                                                                value={prescriptionEditForm.dosage}
                                                                disabled={!prescriptionEditUnlocked}
                                                                onChange={(e) =>
                                                                    setPrescriptionEditForm({
                                                                        ...prescriptionEditForm,
                                                                        dosage: e.target.value,
                                                                    })}
                                                            />
                                                            <Input
                                                                id={`rex-duration-${r.id}`}
                                                                label={t("page.prescriptions.field.duration")}
                                                                value={prescriptionEditForm.duration}
                                                                disabled={!prescriptionEditUnlocked}
                                                                onChange={(e) =>
                                                                    setPrescriptionEditForm({
                                                                        ...prescriptionEditForm,
                                                                        duration: e.target.value,
                                                                    })}
                                                            />
                                                        </div>
                                                        <Textarea
                                                            id={`rex-hin-${r.id}`}
                                                            label={t("common.notes")}
                                                            rows={2}
                                                            value={prescriptionEditForm.instructions}
                                                            disabled={!prescriptionEditUnlocked}
                                                            onChange={(e) =>
                                                                setPrescriptionEditForm({
                                                                    ...prescriptionEditForm,
                                                                    instructions: e.target.value,
                                                                })}
                                                        />
                                                    </ChartEditFormOrInline>
                                                </td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <td style={{ fontWeight: 600 }}>{r.medication}</td>
                                            <td>{r.dosage}</td>
                                            <td>{r.duration}</td>
                                            <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                            <td>{formatDate(r.issued_at)}</td>
                                            <td className="prescription-td-actions">
                                                {(() => {
                                                    const actions: PaymentRowAction[] = [
                                                        {
                                                            id: "export",
                                                            label: t("common.export"),
                                                            onClick: () => handlePrintPrescription(r),
                                                        },
                                                    ];
                                                    if (canWriteMedical) {
                                                        actions.push(
                                                            {
                                                                id: "edit",
                                                                label: t("common.edit"),
                                                                onClick: () => {
                                                                    setPrescriptionDeleteId(null);
                                                                    resetPrescriptionWizard();
                                                                    setPrescriptionEditUnlocked(false);
                                                                    setPrescriptionEditForm({
                                                                        medication: r.medication,
                                                                        active_ingredient: r.active_ingredient ?? "",
                                                                        dosage: r.dosage,
                                                                        duration: r.duration,
                                                                        instructions: r.instructions ?? "",
                                                                    });
                                                                    setPrescriptionEdit(r);
                                                                },
                                                            },
                                                            {
                                                                id: "delete",
                                                                label: t("common.delete"),
                                                                onClick: () => {
                                                                    resetPrescriptionWizard();
                                                                    setPrescriptionEdit(null);
                                                                    setPrescriptionDeleteId(r.id);
                                                                },
                                                                danger: true,
                                                            },
                                                        );
                                                    }
                                                    return (
                                                        <PaymentRowActionsMenu
                                                            ariaLabel={t("common.actions")}
                                                            actions={actions}
                                                        />
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {canWriteMedical && prescriptionDeleteId ? (
                <ConfirmOrInline
                    area="patient_chart_prescription_delete"
                    open={canWriteMedical && !!prescriptionDeleteId}
                    inlineId="ak-prescription-delete-panel"
                    title={t("page.patient_detail.prescription.delete_title")}
                    message={(() => {
                        const r = prescriptions.find((x) => x.id === prescriptionDeleteId);
                        return r
                            ? tp("page.patient_detail.prescription.delete_confirm", {
                                medication: r.medication,
                                dosage: r.dosage,
                                duration: r.duration,
                            })
                            : t("page.patient_detail.prescription.delete_confirm_generic");
                    })()}
                    onCancel={() => setPrescriptionDeleteId(null)}
                    onConfirm={() => void handleDeletePrescription()}
                    confirmLabel={t("common.yes_delete")}
                    danger
                />
            ) : null}


        </FormSection>
        </>
        ) : (
        <>
        <CardHeader
            title={t("page.patient_detail.certificate.title")}
            subtitle={t("page.patient_detail.certificate.subtitle")}
            action={canWriteMedical ? (
                <>
                    <Button type="button" size="sm" variant="secondary" onClick={openCertificatePick} disabled={!id}>
                        {t("page.patient_detail.certificate.predefined_btn")}
                    </Button>
                    <Button type="button" size="sm" onClick={openCertificateNew} disabled={!id}>
                        <PlusIcon /> {t("page.patient_detail.certificate.new_btn")}
                    </Button>
                </>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                {t("page.patient_detail.certificate.readonly_hint")}
            </p>
        ) : null}

            {canWriteMedical && certificateWizardStep ? (
                <div
                    ref={certificateWizardPanelRef}
                    id="ak-certificate-wizard-panel"
                    className="prescription-chart-panel"
                    role="region"
                    aria-label={t("page.patient_detail.certificate.wizard_aria")}
                >
                    <div className="prescription-chart-panel-head">
                        <div>
                            <div className="prescription-chart-panel-title">
                                {certificateWizardStep === "pick" ? t("page.patient_detail.certificate.wizard_pick_title") : null}
                                {certificateWizardStep === "compose"
                                    ? (certificateComposerKind === "template" ? t("page.patient_detail.certificate.wizard_from_template") : t("page.patient_detail.certificate.wizard_new"))
                                    : null}
                                {certificateWizardStep === "ask_template" ? t("page.patient_detail.certificate.wizard_save_template_q") : null}
                                {certificateWizardStep === "name_template" ? t("page.patient_detail.certificate.wizard_template_name") : null}
                            </div>
                            {certificateWizardStep === "pick" ? (
                                <div className="prescription-chart-panel-sub">
                                    {t("page.patient_detail.certificate.pick_sub")}
                                </div>
                            ) : null}
                            {certificateWizardStep === "compose" ? (
                                <div className="prescription-chart-panel-sub">
                                    {t("page.patient_detail.certificate.compose_sub")}
                                </div>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!certificateComposerBusy) resetCertificateWizard();
                            }}
                            disabled={certificateComposerBusy}
                        >
                            {t("common.close")}
                        </Button>
                    </div>

                    <div className="prescription-chart-panel-body">
                        {certificateWizardStep === "pick" ? (
                            <>
                                <datalist id="ak-certificate-templates-dl">
                                    {certificateTemplates.map((version) => (
                                        <option key={version.id} value={version.title} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-att-pick-q"
                                    label={t("common.template_search")}
                                    list="ak-certificate-templates-dl"
                                    value={certificatePickQuery}
                                    onChange={(e) => {
                                        setCertificatePickQuery(e.target.value);
                                        setCertificatePickSelectedId("");
                                    }}
                                    placeholder={t("common.search_title_ph")}
                                />
                                <div
                                    style={{
                                        maxHeight: 200,
                                        overflowY: "auto",
                                        marginTop: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    {certificatePickFiltered.length === 0 ? (
                                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                            {t("page.patient_detail.certificate.no_results")}
                                        </span>
                                    ) : (
                                        certificatePickFiltered.slice(0, 24).map((version) => (
                                            <button
                                                key={version.id}
                                                type="button"
                                                className="btn btn-subtle btn-sm"
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                onClick={() => {
                                                    setCertificatePickSelectedId(version.id);
                                                    setCertificatePickQuery(version.title);
                                                }}
                                            >
                                                {version.title}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}

                        {certificateWizardStep === "compose" ? (
                            <>
                                {certificateComposerKind === "template" && certificateListeGeaendert ? (
                                    <p
                                        style={{
                                            fontSize: 12.5,
                                            marginTop: 0,
                                            marginBottom: 12,
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            background: "var(--accent-soft)",
                                            color: "var(--accent-ink)",
                                        }}
                                    >
                                        {t("page.patient_detail.certificate.template_modified").split(t("page.patient_detail.certificate.template_modified_emphasis"))[0]}
                                        <strong>{t("page.patient_detail.certificate.template_modified_emphasis")}</strong>
                                        {t("page.patient_detail.certificate.template_modified").split(t("page.patient_detail.certificate.template_modified_emphasis"))[1]}
                                    </p>
                                ) : null}
                                {certificateDraftErr ? (
                                    <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{certificateDraftErr}</p>
                                ) : null}
                                <Select
                                    id="ak-att-kind"
                                    label={t("page.patient_detail.certificate.field.type")}
                                    value={certificateForm.kind}
                                    onChange={(e) => setCertificateForm({ ...certificateForm, kind: e.target.value })}
                                    options={certificateKindSelectOptions(t)}
                                />
                                <div className="row" style={{ gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t("page.patient_detail.certificate.certification")}</span>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={certificateForm.first_or_follow_up === "FIRST"}
                                            onChange={() => setCertificateForm({ ...certificateForm, first_or_follow_up: "FIRST" })}
                                        />
                                        {t("page.patient_detail.certificate.first_cert")}
                                    </label>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={certificateForm.first_or_follow_up === "FOLLOW_UP"}
                                            onChange={() => setCertificateForm({ ...certificateForm, first_or_follow_up: "FOLLOW_UP" })}
                                        />
                                        {t("page.patient_detail.certificate.follow_cert")}
                                    </label>
                                </div>
                                <Input
                                    id="ak-att-icd"
                                    label={t("page.patient_detail.certificate.field.icd")}
                                    value={certificateForm.icd10_code}
                                    onChange={(e) => setCertificateForm({ ...certificateForm, icd10_code: e.target.value })}
                                    placeholder={t("page.patient_detail.certificate.field.icd_ph")}
                                />
                                {certificateForm.kind.includes("SICK_LEAVE") ? (
                                    <Input
                                        id="ak-att-ag"
                                        label={t("page.patient_detail.certificate.employer")}
                                        value={certificateForm.employer}
                                        onChange={(e) => setCertificateForm({ ...certificateForm, employer: e.target.value })}
                                    />
                                ) : null}
                                <datalist id="ak-certificate-krank-dl">
                                    {illnessSuggestionLabels(t).map((label) => (
                                        <option key={label} value={label} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-att-krank"
                                    label={t("page.patient_detail.certificate.diagnosis")}
                                    list="ak-certificate-krank-dl"
                                    value={certificateForm.krankheiten}
                                    onChange={(e) => setCertificateForm({ ...certificateForm, krankheiten: e.target.value })}
                                    placeholder={t("page.patient_detail.certificate.diagnosis_ph")}
                                />
                                <Input
                                    id="ak-att-tage"
                                    label={t("page.patient_detail.certificate.field.days")}
                                    type="number"
                                    min={1}
                                    max={366}
                                    inputMode="numeric"
                                    value={certificateForm.tageAnzahl}
                                    onChange={(e) => {
                                        const tage = e.target.value;
                                        setCertificateForm((p) => ({
                                            ...p,
                                            tageAnzahl: tage,
                                            valid_until: certificateGueltigUntilFromFromAndTage(p.valid_from, tage),
                                        }));
                                    }}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        id="ak-att-from"
                                        type="date"
                                        label={`${t("common.valid_from")} *`}
                                        value={certificateForm.valid_from}
                                        onChange={(e) => {
                                            const from = e.target.value;
                                            setCertificateForm((p) => ({
                                                ...p,
                                                valid_from: from,
                                                valid_until: certificateGueltigUntilFromFromAndTage(from, p.tageAnzahl),
                                            }));
                                        }}
                                    />
                                    <Input
                                        id="ak-att-until"
                                        type="date"
                                        label={`${t("common.valid_until")} *`}
                                        value={certificateForm.valid_until}
                                        onChange={(e) => setCertificateForm({ ...certificateForm, valid_until: e.target.value })}
                                    />
                                </div>
                                <Textarea
                                    id="ak-att-ein"
                                    label={t("page.patient_detail.certificate.field.restriction")}
                                    rows={4}
                                    value={certificateForm.einschraenkung}
                                    onChange={(e) => setCertificateForm({ ...certificateForm, einschraenkung: e.target.value })}
                                />
                            </>
                        ) : null}

                        {certificateWizardStep === "ask_template" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>{t("common.yes")}:</strong> {t("page.patient_detail.certificate.ask_template_yes")}
                                {" "}
                                <strong>{t("common.no")}:</strong> {t("page.patient_detail.certificate.ask_template_no")}
                            </p>
                        ) : null}

                        {certificateWizardStep === "name_template" ? (
                            <Input
                                id="ak-att-template-name"
                                label={t("common.template_label")}
                                value={certificateNewTemplateTitle}
                                onChange={(e) => setCertificateNewTemplateTitle(e.target.value)}
                                placeholder={t("page.patient_detail.certificate.template_ph")}
                            />
                        ) : null}
                    </div>

                    <div className="prescription-chart-panel-actions">
                        {certificateWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetCertificateWizard()}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="button" onClick={proceedCertificatePick}>
                                    {t("common.next")}
                                </Button>
                            </>
                        ) : null}
                        {certificateWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetCertificateWizard()} disabled={certificateComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitCertificateComposer()}
                                    loading={certificateComposerBusy}
                                    disabled={certificateComposerBusy}
                                >
                                    {t("page.patient_detail.certificate.save_for_patient")}
                                </Button>
                            </>
                        ) : null}
                        {certificateWizardStep === "ask_template" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onCertificateAskTemplateNo}>
                                    {t("common.no")}
                                </Button>
                                <Button type="button" onClick={onCertificateAskTemplateYes}>
                                    {t("common.yes")}
                                </Button>
                            </>
                        ) : null}
                        {certificateWizardStep === "name_template" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onCertificateNameTemplateSkip} disabled={certificateComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onCertificateNameTemplateSave()}
                                    loading={certificateComposerBusy}
                                    disabled={certificateComposerBusy}
                                >
                                    {t("page.patient_detail.certificate.save_template_and")}
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}

        <FormSection title={t("page.patient_detail.certificate.list_section")}>
            {certificates.length === 0 ? (
                <EmptyState
                    icon="📄"
                    title={t("page.patient_detail.certificate.empty_title")}
                    description={canWriteMedical
                        ? t("page.patient_detail.certificate.empty_desc_write")
                        : t("page.patient_detail.certificate.empty_desc_read")}
                    action={canWriteMedical && id
                        ? { label: t("page.patient_detail.certificate.new_btn"), onClick: openCertificateNew }
                        : undefined}
                />
            ) : (
                <div className="prescription-certificate-table-scroll">
                    <table className="tbl tbl-certificate-chart">
                        <thead>
                            <tr>
                                <th>{t("page.patient_detail.certificate.col.type")}</th>
                                <th>{t("common.valid_from")}</th>
                                <th>{t("common.valid_until")}</th>
                                <th>{t("common.issued")}</th>
                                <th className="certificate-th-actions">{t("patient.detail.tab.treatment.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {certificates.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ fontWeight: 600 }}>{a.kind}</td>
                                    <td>{formatDate(a.valid_from)}</td>
                                    <td>{formatDate(a.valid_until)}</td>
                                    <td>{formatDate(a.issued_at)}</td>
                                    <td className="certificate-td-actions">
                                        {(() => {
                                            const actions: PaymentRowAction[] = [
                                                {
                                                    id: "export",
                                                    label: t("common.export"),
                                                    onClick: () => handlePrintCertificate(a),
                                                },
                                            ];
                                            if (canWriteMedical) {
                                                actions.push({
                                                    id: "delete",
                                                    label: t("common.delete"),
                                                    onClick: () => {
                                                        resetCertificateWizard();
                                                        setCertificateDeleteId(a.id);
                                                    },
                                                    danger: true,
                                                });
                                            }
                                            return (
                                                <PaymentRowActionsMenu
                                                    ariaLabel={t("common.actions")}
                                                    actions={actions}
                                                />
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {canWriteMedical && certificateDeleteId ? (
                <ConfirmOrInline
                    area="patient_chart_certificate_delete"
                    open={canWriteMedical && !!certificateDeleteId}
                    inlineId="ak-certificate-delete-panel"
                    title={t("page.patient_detail.certificate.delete_title")}
                    message={(() => {
                        const a = certificates.find((x) => x.id === certificateDeleteId);
                        return a
                            ? tp("page.patient_detail.certificate.delete_confirm", {
                                type: a.kind,
                                from: formatDate(a.valid_from),
                                to: formatDate(a.valid_until),
                            })
                            : t("page.patient_detail.certificate.delete_confirm_generic");
                    })()}
                    onCancel={() => setCertificateDeleteId(null)}
                    onConfirm={() => void handleDeleteCertificate()}
                    confirmLabel={t("common.yes_delete")}
                    danger
                />
            ) : null}


        </FormSection>
        </>
        )}
    </Card>
    </div>
    );
}
